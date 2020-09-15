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
  UPLOAD_FIRMWARE_BOSSAC: '5c61682e3ce2544365b05577f9016d5fbfa4c20efdce6ec2ebe6940380ea4f9421322b338c83b7721f900c99c61282720224d9fb20a639154984fd1feef682ee432c8a225f14fe7ba80d2d71d51bc92bfffe63de9386c0b9bc17a827ce21dda837fe3fd0c518ff0b84982c65db81a3eebab88712593c068f5a43f7bc22d4a3f3608969e8f30b3102b382d2c0f7f28d482b39cbcfd16eb680dd04bda66b9cb0d1c2b2e91d89dd8c6033562f1d3983002b61aa39ef70d45a456178867609c058a09bbcd8bce4d97d2e65c28756659bf5ba111e8541302cea934a2c005331ef89425390f610d2f609d581175d16193e72752fe8384f66051e6a2abea79757f042eb',
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
          de
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
