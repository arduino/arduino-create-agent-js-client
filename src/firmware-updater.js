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
  UPLOAD_FIRMWARE_BOSSAC: 'b2137435f74601a0b1b090ca1592b14199c1c79c87cecac4bb168456b570f17b635f438f5cd80649a101ab27085394e4a0e92f41a2b1b65932789eee8c3ebf39633a503a8a53d3291944afe10ff88f6ea06b0fd7fd7de6d70b302df3a92091a2abe2691ad1aeee051e4bb69f6afa3bd41e643855769347dca018804ae97bcb1331df796fd8921a11b333b45bebe430d323ddd151a907e8fb0e875a45d093cdb4332ec3dbd72a50341b538e058b3f25d4a528bea514b96b8e0701032d64232b7141c62f2231352f4197a1011292a4c3e900c133824e148f3703ea8374873d9097578146819e62685f1a8cbc442dd435ea603136c86ecf028df39fd10a8b3499c6',
  UPLOAD_FIRMWARE_AVRDUDE: '68ed3d9abdc7c77d01223d09c7ae55b08b8ff94f2a42d21a672effb4bdeeb12b10177e831805b3037d9f8d38e8eeeb8327b6c4691731a2a146cfd12398e5a12596e097160ae8d84fc488650ee57439f7fcd83f27d01e9834de555ceec7dc6951b3be5e5a3507752dce8e4ba1f6f9e6494162d537009db899882b9c4fca0868ad446b82fdeabf93bc30c5a39f8fe9c25e799842a10f4171e2896a0e19667b34258f06494663a4a102bcf9fd61d1ff8ebec18204bbd1a66de3e0b53e257ce521b41999dc82428539086ae9a4a5ea7112d87c05a2782cdace0e6576b162294f9ba47c658cc40999ba31be8a129689a703f6c4182055a600b6e41d450fad2896180d'
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
    this.Daemon.downloadingDone.subscribe(() => {
      this.FWUToolStatus = FWUToolStatusEnum.OK;
    });

    this.FWUToolStatus = FWUToolStatusEnum.NOPE;
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
          commandline: `"{runtime.tools.fwupdater.path}/updater" -flasher {network.password} -firmware {upload.verbose} -port {serial.port} -restore_binary "{build.path}/{build.project_name}.bin" -programmer ${programmer}`,
          hex: '',
          extra: {
            auth: {
              password: this.loaderPath
            },
            verbose: true,
            params_verbose: `${this.firmwareVersionData.Path} ${addresses}` // eslint-disable-line camelcase
          },
          signature: isUsingAvrdude ? signaturesEnum.UPLOAD_FIRMWARE_AVRDUDE : signaturesEnum.UPLOAD_FIRMWARE_BOSSAC,
          filename: 'CheckFirmwareVersion.bin'
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
