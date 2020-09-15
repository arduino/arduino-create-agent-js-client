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
  UPLOAD_FIRMWARE_BOSSAC: '5f164410e51db804529b94e11597092de0297b78cda74ffc132d9017dd9e996abddfe927de2ec86d79af412326a331b7f327ac40bf10468c1b26da702d85241a39336600afcd608d5b018fd87e97ba96bd685f8c00c20b62eb71b3c1cac05e9c9bd46e8f4238bea56fbf755b950f41dba5df71e2c04d4413a7e75c35c3cf2d141dbe935102c619152ada1e965ad8c706fe39c4dd2e8d51971798ce26af1089ab3efbead61ac7b222ebaf95529999e9832a05402741a70871998e32e7a9b6b15c42fbd024a126bd5bb580991dedb45125260dac453350c9989d461b1e2bd084ecf0e7908375d5addc5ae78465461481c351cfee39d9211aa8a5ae6a6011ff8fe0',
  UPLOAD_FIRMWARE_AVRDUDE: '3007b6053d6c5a1614143818061b7749a570044125bc033a93427ca8db44b1176b7963b45a3749778c1cf82a23d90a065a54ae946f56d4e37ea4a39d50e522b7c4154099292b46b29aca72530a7cb1b91f03d3ed041632c8d294e09cd80da9f1fe529729e5098097a31d50e78ceb0ac82b2c3afc9dccd11508f587ba78debaff11d3e34da2ed8b9489eaafc5d5f4184060f0749cf7dbb20334b22580b33d18c60dc4901956c4497334184937200778a8f7ddc6fc48cb6a632017d16a401f5416035e3d7fcefef5fc0e893f405454eed85eb7a44a6aabfa75cee2b345a4932eed3b301695ce0cffd2e9cb57b9241e43f33b776136fefe066868077861f1724490'
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
          commandline: `"{runtime.tools.fwupdater.path}/updater" -flasher {network.password} -firmware {network.username} -port {serial.port} -restore_binary "{build.path}/{build.project_name}.bin" -programmer ${programmer}`,
          hex: '',
          extra: {
            auth: {
              password: this.loaderPath,
              username: `${this.firmwareVersionData.Path} ${addresses}`
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
