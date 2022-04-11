import { BehaviorSubject } from 'rxjs';
import semverCompare from 'semver-compare';
import { takeUntil, filter, first } from 'rxjs/operators';
import { fwupdaterSignatures, oldFwupdaterSignatures } from './signatures';

/* The status of the Firmware Updater Tool */
const FWUToolStatusEnum = Object.freeze({
  NOPE: 'NOPE',
  OK: 'OK',
  CHECKING: 'CHECKING',
  ERROR: 'ERROR DOWNLOADING TOOL'
});

/* The signatures needed to run the commands to use the Firmware Updater Tool */
let signatures = fwupdaterSignatures;

let updaterBinaryName = 'FirmwareUploader';

function programmerFor(boardId) {
  if (boardId === 'uno2018') return ['{runtime.tools.avrdude}/bin/avrdude', signatures.UPLOAD_FIRMWARE_AVRDUDE];
  if (boardId === 'nanorp2040connect') return [`{runtime.tools.rp2040tools.path}/rp2040load`, signatures.UPLOAD_FIRMWARE_RP2040];

  return [`{runtime.tools.bossac}/bossac`, signatures.UPLOAD_FIRMWARE_BOSSAC];
}

export default class FirmwareUpdater {
  constructor(Daemon) {
    this.updateStatusEnum = Object.freeze({
      NOPE: 'NOPE',
      STARTED: 'STARTED',
      GETTING_INFO: 'GETTING_INFO',
      GOT_INFO: 'GOT_INFO',
      UPLOADING: 'UPLOADING',
      DONE: 'DONE',
      ERROR: 'ERROR'
    });

    this.Daemon = Daemon;
    this.FWUToolStatus = FWUToolStatusEnum.NOPE;
    this.Daemon.downloadingDone.subscribe(() => {
      this.FWUToolStatus = FWUToolStatusEnum.OK;
    });

    this.updating = new BehaviorSubject({ status: this.updateStatusEnum.NOPE });

    this.updatingDone = this.updating.pipe(filter(update => update.status === this.updateStatusEnum.DONE))
      .pipe(first())
      .pipe(takeUntil(this.updating.pipe(filter(update => update.status === this.updateStatusEnum.ERROR))));

    this.updatingError = this.updating.pipe(filter(update => update.status === this.updateStatusEnum.ERROR))
      .pipe(first())
      .pipe(takeUntil(this.updatingDone));

    this.gotFWInfo = this.updating.pipe(filter(update => update.status === this.updateStatusEnum.GOT_INFO))
      .pipe(first())
      .pipe(takeUntil(this.updatingDone))
      .pipe(takeUntil(this.updatingError));
  }

  setToolVersion(version) {
    this.toolVersion = version;
    if (semverCompare(version, '0.1.2') < 0) {
      signatures = oldFwupdaterSignatures;
      updaterBinaryName = 'updater';
    }
  }

  getFirmwareInfo(boardId, port, firmwareVersion) {
    this.firmwareVersionData = null;
    this.loaderPath = null;
    this.updating.next({ status: this.updateStatusEnum.GETTING_INFO });
    let versionsList = [];
    let firmwareInfoMessagesSubscription;

    const handleFirmwareInfoMessage = message => {
      let versions;
      switch (message.ProgrammerStatus) {
        case 'Starting':
          break;
        case 'Busy':
          if (message.Msg.indexOf('Flashing with command:') >= 0) {
            return;
          }
          versions = JSON.parse(message.Msg);
          Object.keys(versions).forEach(v => {
            if (versions[v][0].IsLoader) {
              this.loaderPath = versions[v][0].Path;
            }
            else {
              versionsList = [...versionsList, ...versions[v]];
            }
          });
          this.firmwareVersionData = versionsList.find(version => version.Name.split(' ').splice(-1)[0].trim() === firmwareVersion);
          if (!this.firmwareVersionData) {
            this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't get firmware info: couldn't find version '${firmwareVersion}' for board '${boardId}'` });
          }
          else {
            firmwareInfoMessagesSubscription.unsubscribe();
            this.updating.next({ status: this.updateStatusEnum.GOT_INFO });
          }
          break;
        case 'Error':
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Couldn't get firmware info: ${message.Msg}` });
          firmwareInfoMessagesSubscription.unsubscribe();
          break;
        default:
          break;
      }
    };

    if (this.FWUToolStatus !== FWUToolStatusEnum.OK) {
      this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't get firmware info: couldn't find firmware updater tool` });
      return;
    }

    firmwareInfoMessagesSubscription = this.Daemon.appMessages.subscribe(message => {
      if (message.ProgrammerStatus) {
        handleFirmwareInfoMessage(message);
      }
    });
    const data = {
      board: boardId,
      port,
      commandline: `"{runtime.tools.fwupdater.path}/${updaterBinaryName}" -get_available_for {network.password}`,
      signature: signatures.GET_FIRMWARE_INFO,
      extra: {
        auth: {
          password: boardId
        }
      },
      filename: 'ListFirmwareVersionsInfo.bin'
    };

    return fetch(`${this.Daemon.pluginURL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: JSON.stringify(data)
    }).then(response => {
      if (!response.ok) {
        this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Error fetching ${this.Daemon.pluginURL}/upload` });

      }
    }).catch(() => {
      this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Coudln't list firmware versions info.` });

    });
  }

  updateFirmware(boardId, port, firmwareVersion) {
    this.updating.next({ status: this.updateStatusEnum.STARTED });
    this.Daemon.closeSerialMonitor(port);
    this.Daemon.serialMonitorOpened.pipe(filter(open => !open)).pipe(first()).subscribe(() => {
      if (!port) {
        this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: no port selected.` });
        return;
      }
      this.gotFWInfo.subscribe(() => {
        if (!this.firmwareVersionData) {
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: couldn't find version '${firmwareVersion}' for board '${boardId}'` });
          return;
        }

        let updateFirmwareMessagesSubscription;

        const handleFirmwareUpdateMessage = message => {
          switch (message.ProgrammerStatus) {
            case 'Busy':
              if (message.Msg.indexOf('Operation completed: success! :-)') >= 0) {
                this.updating.next({ status: this.updateStatusEnum.DONE });
                updateFirmwareMessagesSubscription.unsubscribe();
              }
              break;
            case 'Error':
              this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: ${message.Msg}` });
              updateFirmwareMessagesSubscription.unsubscribe();
              break;
            default:
              break;
          }
        };

        updateFirmwareMessagesSubscription = this.Daemon.appMessages.subscribe(message => {
          if (message.ProgrammerStatus) {
            handleFirmwareUpdateMessage(message);
          }
        });

        const [programmer, signature] = programmerFor(boardId);

        if (!this.loaderPath) {
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: 'loaderPath' is empty or 'null'` });
          return;
        }

        const data = {
          board: boardId,
          port,
          commandline: `"{runtime.tools.fwupdater.path}/${updaterBinaryName}" -flasher {network.password} -port {serial.port} -programmer "${programmer}"`,
          hex: '',
          extra: {
            auth: {
              password: `"${this.loaderPath}" -firmware "${this.firmwareVersionData.Path}"`,
            },
          },
          signature,
          filename: 'CheckFirmwareVersion.bin',
        };

        fetch(`${this.Daemon.pluginURL}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8'
          },
          body: JSON.stringify(data)
        }).then(response => {
          if (!response.ok) {
            this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: error fetching ${this.Daemon.pluginURL}/upload` });

          }
        }).catch(reason => {
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: ${reason}` });

        });
      });
      this.getFirmwareInfo(boardId, port, firmwareVersion);
    });
  }
}
