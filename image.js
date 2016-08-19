import React from 'react';
import { Image, ProgressBarAndroid } from 'react-native';
import RNFS, { DocumentDirectoryPath } from 'react-native-fs';
import ResponsiveImage from 'react-native-responsive-image';

const SHA1 = require("crypto-js/sha1");
const URL = require('url-parse');

export default
class CacheableImage extends React.Component {
  state: {
    isRemote: false,
    cachedImagePath: null,
    downloading: false,
    cacheable: true,
    jobId: null
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.source != this.props.source) {
      this._processSource(nextProps.source);
    }
  }

  async imageDownloadBegin(info) {
    this.setState({downloading: true, jobId: info.jobId});
  }

  async imageDownloadProgress(info) {
    if ((info.contentLength / info.bytesWritten) == 1) {
      this.setState({downloading: false, jobId: null});
    }
  }

  async checkImageCache(imageUri, cachePath, cacheKey) {
    const dirPath = DocumentDirectoryPath+'/'+cachePath;
    const filePath = dirPath+'/'+cacheKey;

    RNFS
    .stat(filePath)
    .then((res) => {
      if (res.isFile()) {
        // means file exists, ie, cache-hit
        this.setState({cacheable: true, cachedImagePath: filePath});
      }
    })
    .catch((err) => {
      // means file does not exist
      // first make sure directory exists.. then begin download
      RNFS
      .mkdir(dirPath, true)
      .then(() => {
        // Keep all files for cache

        // // before we change the cachedImagePath.. if the previous cachedImagePath was set.. remove it
        // if (this.state.cacheable && this.state.cachedImagePath) {
        //   let delImagePath = this.state.cachedImagePath;
        //   RNFS
        //   .exists(delImagePath)
        //   .then((res) => {
        //     if (res) {
        //       RNFS
        //       .unlink(delImagePath)
        //       .catch((err) => {});
        //     }
        //   });
        // }

        let downloadOptions = {
          fromUrl: imageUri,
          toFile: filePath,
          background: true,
          begin: this.imageDownloadBegin.bind(this),
          progress: this.imageDownloadProgress.bind(this)
        };

        // directory exists.. begin download
        RNFS
        .downloadFile(downloadOptions)
        .then(() => {
          this.setState({cacheable: true, cachedImagePath: filePath});
        })
        .catch((err) => {
          this.setState({cacheable: false, cachedImagePath: null});
        });
      })
      .catch((err) => {
        this.setState({cacheable: false, cachedImagePath: null});
      })
    });
  }

  _processSource(source) {
    if (source !== null
      && typeof source === "object"
      && source.hasOwnProperty('uri'))
      { // remote
        const url = new URL(source.uri);
        const type = url.pathname.replace(/.*\.(.*)/, '$1');
        const cacheKey = SHA1(url.pathname)+'.'+type;

        this.checkImageCache(source.uri, url.host, cacheKey);
        this.setState({isRemote: true});
      }
      else {
        this.setState({isRemote: false});
      }
    }

    componentWillMount() {
      this._processSource(this.props.source);
    }

    componentWillUnmount() {
      if (this.state.downloading && this.state.jobId) {
        RNFS.stopDownload(this.state.jobId);
      }
    }

    render() {
      if (!this.state.isRemote || !this.state.cacheable) {
        return this.renderLocal();
      }

      if (this.state.cacheable && this.state.cachedImagePath) {
        return this.renderCache();
      }

      return (
        <ProgressBarAndroid  />
      );
    }

    renderCache() {
      return (
        <ResponsiveImage {...this.props} source={{uri: 'file://'+this.state.cachedImagePath}}>
          {this.props.children}
        </ResponsiveImage>
      );
    }

    renderLocal() {
      return (
        <ResponsiveImage {...this.props} >
          {this.props.children}
        </ResponsiveImage>
      );
    }
  }
