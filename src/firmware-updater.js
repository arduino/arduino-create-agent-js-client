import { BehaviorSubject } from 'rxjs';

import {
  takeUntil,
  filter,
  first
} from 'rxjs/operators';

/* The status of the Firmware Updater Tool */
const FWUToolStatusEnum = Object.freeze({
  NOPE: 'NOPE',
  OK: 'OK',
  CHECKING: 'CHECKING',
  ERROR: 'ERROR DOWNLOADING TOOL'
});

/* The signatures needed to run the commands to use the Firmware Updater Tool */
const signaturesEnum = Object.freeze({
  GET_FIRMWARE_INFO: 'aceffd98d331df0daa5bb3308bb49a95767d77e7a1557c07a0ec544d2f41c3ec67269f01ce9a63e01f3b43e087ab8eb22b7f1d34135b6686e8ce27d4b5dc083ec8e6149df11880d32486448a71280ef3128efccbd45a84dbd7990a9420a65ee86b3822edba3554fa8e6ca11aec12d4dd99ad072285b98bfdf7b2b64f677da50feb8bddef25a36f52d7605078487d8a5d7cbdc84bfa65d510cee97b46baefea149139a9a6ed4b545346040536e33d850e6ad84c83fe605f677e2ca77439de3fa42350ce504ad9a49cf62c6751d4c2a284500d2c628cd52cd73b4c3e7ef08ae823eb8941383f9c6ff0686da532369d3b266ded8fdd33cca1a128068a4795920f25',
  UPLOAD_FIRMWARE_BOSSAC: '0ebbe429902601f10e5e33ffb0ffb168db8d6f40a0b6d3c7dce98795842d52b60a29100bc9ba315a48ad4cd2fee85f2efd3fbde37dcff395791bd0ff72e54d736ad2f3a82cf1571a79df27dec7ba1ae7983386b48ea28f52a94f2939588f332b87cdcf6a026fb5035313334f3e15671e4059475a036cd5e0b564b4a591b3a96cea6f9147685bc631a2f56843cc33d4a73cb4ab606e0cf6d38caa357d89275a4e5bb54fa1f00af30295f7ec3ff3cace43cc8ad756f1b0a18f12ff2a52fce8bda10d3485af3004359af7e5838cfe64e7f81f7b6f161f3b57c29e5bcc237112dc8bc022fbe089c019c7fa0bd0ab3a3c9027e7d3d564aaaeed6619e1f6d4fce25f85',
  UPLOAD_FIRMWARE_AVRDUDE: '83b177b05dcd7043d484e321417d1dd499fdbd80b7109cc86fcb91cb14e59b834c3956a279e8d4ceba466a308cb8a1aceb5ab6770b8f207e9bc92e84a191edc21cdecb4f7cc1883fbf0eb258f1f849ffbe76bb0320dfe92d85f77226b45fd90824fc126e22ebe8d2350f854c9d43a03186d7f260d8d03bf83e6669646b2e13a6371dcbf1dd5711edcbe3c3a0f186d091ba26118ed2cdb3ef58e0079096403a2e93684d5089b216c53f2fcb1387b6e9d49feea914943971ac1e58bba1ecdf4f14f557d278e8b4f05d594e21887ba87322fbe1d70d05f03412d87f3149a4b3aff302088a2f0ecc42302b6ba66024e94226b5d99c9e0375383e4494bc1e0d0e20b8'
});


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
          break;
        case 'Error':
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Couldn't get firmware info: ${message.Msg}` });
          firmwareInfoMessagesSubscription.unsubscribe();
          break;
        case 'Done':
          firmwareInfoMessagesSubscription.unsubscribe();
          this.updating.next({ status: this.updateStatusEnum.GOT_INFO });
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
      commandline: `"{runtime.tools.fwupdater.path}/updater" -get_available_for {network.password}`,
      signature: signaturesEnum.GET_FIRMWARE_INFO,
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
            case 'Error':
              this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: ${message.Msg}` });
              updateFirmwareMessagesSubscription.unsubscribe();
              break;
            case 'Done':
              this.updating.next({ status: this.updateStatusEnum.DONE });
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

        let addresses = '';
        const rootCertificates = [{
          domain: 'arduino.cc',
          port: 443
        }];

        rootCertificates.forEach(address => {
          if (address.domain && address.port) {
            addresses += `-address ${address.domain}:${address.port} `;
          }
        });

        const isUsingAvrdude = boardId === 'uno2018';
        const programmer = isUsingAvrdude ? '{runtime.tools.avrdude}/bin/avrdude' : '{runtime.tools.bossac}/bossac';

        if (!this.loaderPath) {
          this.updating.next({ status: this.updateStatusEnum.ERROR, err: `Can't update Firmware: 'loaderPath' is empty or 'null'` });
          return;
        }

        const data = {
          board: boardId,
          port,
          commandline: `"{runtime.tools.fwupdater.path}/updater" -flasher {network.password} -port {serial.port} -restore_binary "{build.path}/{build.project_name}.bin" -programmer ${programmer}`,
          hex: '',
          extra: {
            auth: {
              password: `${this.loaderPath} -firmware ${this.firmwareVersionData.Path} ${addresses}`,
            },
          },
          signature: isUsingAvrdude ? signaturesEnum.UPLOAD_FIRMWARE_AVRDUDE : signaturesEnum.UPLOAD_FIRMWARE_BOSSAC,
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
