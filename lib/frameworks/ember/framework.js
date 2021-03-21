/* eslint-disable max-len */
const Framework        = require('../framework');
const runValidators    = require('../../utils/run-validators');

const UpdateWatchmanIgnore     = require('./tasks/update-watchman-config');
const ValidateLocationType     = require('./validators/location-type');
const ValidateBrowserTargets   = require('./validators/browser-targets');
const ValidatePackage          = require('../../validators/livereload-package');

const ValidateRootUrl          = require('../../validators/root-url');
const InstallPackage           = require('../../tasks/install-package');
/* eslint-enable max-len */

const Build            = require('../../tasks/bash-build');
const Serve            = require('../../tasks/bash-serve');

module.exports = Framework.extend({
  name: 'ember',
  buildCommand: 'ember build',
  serveCommand: 'ember serve',
  buildPath: './dist',
  port: 4200,
  root: undefined,

  //TODO - glimmer should also be a framework
  isGlimmer: false,

  _buildValidators(options) {
    let validations = [];
    let projectConfig = this.project.config(options.environment);

    if (this.isGlimmer === true) { return validations; }

    validations.push(
      new ValidateRootUrl({
        framework: 'ember',
        config: projectConfig,
        rootProps: ['baseURL', 'rootURL', 'baseUrl', 'rootUrl'],
        path: 'config/environment.js',
        force: options.force
      }).run()
    );

    validations.push(
      new ValidateLocationType({
        config: projectConfig,
        force: options.force
      }).run()
    );

    validations.push(
      new ValidateBrowserTargets({
        config: projectConfig,
        root: this.project.root
      }).run()
    );

    return validations;
  },

  validateBuild(options) {
    let validations = this._buildValidators(options);
    return runValidators(validations);
  },

  build(options) {
    let cmd = this.buildCommand;

    if (options && options.environment) {
      cmd += ` --env=${options.environment}`
    }

    let build = new Build({
      buildCommand: cmd,
      buildPath: this.buildPath,
      cordovaOutputPath: options.cordovaOutputPath
    });

    return build.run();
  },

  validateServe(options) {
    let validations = this._buildValidators(options);

    validations.push(
      new ValidatePackage({
        root: this.project.root,
        packageName: 'corber-ember-livereload'
      }).run()
    );

    return runValidators(validations);
  },

  serve(options) {
    for (let option in options) {
      switch (option) {
        case 'port':
        case 'host':
        case 'environment':
          this.serveCommand += ` --${option}=${options[option]}`;
          break;
        case 'ssl':
          if (options[option] === true) {
            this.serveCommand += ` --${option}=${options[option]}`;
          }

          break;
        case 'sslKey':
          if (options.ssl === true) {
            this.serveCommand += ` --ssl-key=${options[option]}`;
          }

          break;
        case 'sslCert':
          if (options.ssl === true) {
            this.serveCommand += ` --ssl-cert=${options[option]}`;
          }

          break;
      }
    }

    let serve = new Serve({
      command: this.serveCommand,
      platform: options.platform
    });

    return serve.run();
  },

  afterInstall() {
    let updateWatchmanIgnore = new UpdateWatchmanIgnore({
      project: this.project,
    });

    let installAddon = new InstallPackage({
      rootPath: this.project.root
    })

    return updateWatchmanIgnore.run()
      .then(() => installAddon.run('corber-ember-livereload'));
  }
});
