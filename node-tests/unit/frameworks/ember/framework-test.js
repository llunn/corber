const td             = require('testdouble');
const expect         = require('../../../helpers/expect');
const mockProject    = require('../../../fixtures/corber-mock/project');
const WatchmanCfg    = require('../../../../lib/frameworks/ember/tasks/update-watchman-config');
const InstallPackage = require('../../../../lib/tasks/install-package');
const Promise        = require('rsvp').Promise;

const initFramework = function() {
  let Ember = require('../../../../lib/frameworks/ember/framework');
  return new Ember({
    project:mockProject.project,
    root: mockProject.project.root
  })
};

describe('Ember Framework', function() {
  afterEach(function() {
    td.reset();
  });

  it('has required props', function() {
    let framework = initFramework();

    expect(framework.name).to.equal('ember');
    expect(framework.buildCommand).to.equal('ember build');
    expect(framework.serveCommand).to.equal('ember serve');
    expect(framework.buildPath).to.equal('./dist');
    expect(framework.port).to.equal(4200);
  });

  it('build initializes a new BuildTask', function() {
    let BuildTask = td.replace('../../../../lib/tasks/bash-build');
    let buildDouble = td.replace(BuildTask.prototype, 'run');
    let framework = initFramework();

    framework.build({cordovaOutputPath: 'fakePath'});
    td.verify(new BuildTask({
      cordovaOutputPath: 'fakePath',
      buildCommand: 'ember build',
      buildPath: './dist'
    }));

    td.verify(buildDouble());
  });

  it('build passes the environment flag', function() {
    let BuildTask = td.replace('../../../../lib/tasks/bash-build');
    let buildDouble = td.replace(BuildTask.prototype, 'run');
    let framework = initFramework();

    framework.build({
      cordovaOutputPath: 'fakePath',
      environment: 'production'
    });

    td.verify(new BuildTask({
      cordovaOutputPath: 'fakePath',
      buildCommand: 'ember build --env=production',
      buildPath: './dist'
    }));

    td.verify(buildDouble());
  });

  it('serve intializes a new ServeTask', function() {
    let ServeTask = td.replace('../../../../lib/tasks/bash-serve');
    let serveDouble = td.replace(ServeTask.prototype, 'run');
    let framework = initFramework();

    framework.serve({platform: 'ios'});
    td.verify(new ServeTask({
      command: framework.serveCommand,
      platform: 'ios'
    }));

    td.verify(serveDouble());
  });

  it('serve uses optional arguments', function() {
    let framework = initFramework();

    const options = {
      environment: 'local',
      host: 'http://some.other.host',
      port:4201,
      platform: 'ios',
      ssl: true,
      sslCert: 'cert-path',
      sslKey: 'key'
    }

    const expectedCommand = 'ember serve --environment=local --host=http://some.other.host --port=4201 --ssl=true --ssl-cert=cert-path --ssl-key=key'
    framework.serve(options);
    expect(framework.serveCommand).to.equal(expectedCommand);
  });

  it('validateBuild calls _buildValidators then runs validators', function() {
    let runValidatorDouble = td.replace('../../../../lib/utils/run-validators');
    let framework = initFramework();

    td.replace(framework, '_buildValidators', function() {
      return ['validations'];
    });

    framework.validateBuild({});
    td.verify(runValidatorDouble(['validations']));
  });

  it('validateServe calls _buildValidators then runs validators', function() {
    let runValidatorDouble = td.replace('../../../../lib/utils/run-validators');

    let ValidatePackage = td.replace('../../../../lib/validators/livereload-package');
    td.replace(ValidatePackage.prototype, 'run', function() {
      return 'validate-corber-ember';
    });

    let framework = initFramework();

    td.replace(framework, '_buildValidators', function() {
      return ['validations'];
    });

    framework.validateServe({});
    td.verify(runValidatorDouble(['validations', 'validate-corber-ember']));
  });

  it('validateServe adds a validator for corber-ember', function() {
    td.replace('../../../../lib/utils/run-validators');
    let ValidatePackage = td.replace('../../../../lib/validators/livereload-package');
    let framework = initFramework();

    framework.validateServe({});

    td.verify(new ValidatePackage({
      root: mockProject.project.root,
      packageName: 'corber-ember-livereload'
    }));
  });

  context('buildValidators', function() {
    it('inits validations', function() {
      let ValidateBrowserTargets = td.replace('../../../../lib/frameworks/ember/validators/browser-targets');
      let ValidateLocation = td.replace('../../../../lib/frameworks/ember/validators/location-type');
      let ValidateRoot = td.replace('../../../../lib/validators/root-url');

      let framework = initFramework();
      let validators = framework._buildValidators({});

      td.verify(new ValidateBrowserTargets({
        config: mockProject.project.config(),
        root: mockProject.project.root
      }));

      td.verify(new ValidateLocation({
        config: mockProject.project.config(),
        force: undefined
      }));

      td.verify(new ValidateRoot({
        framework: 'ember',
        config: mockProject.project.config(),
        rootProps: ['baseURL', 'rootURL', 'baseUrl', 'rootUrl'],
        path: 'config/environment.js',
        force: undefined
      }));

      expect(validators.length).to.equal(3);
    });

    it('passes the force flag to ValidateRootURL', function() {
      let ValidateRoot = td.replace('../../../../lib/validators/root-url');
      let framework = initFramework();

      framework._buildValidators({force: true});

      td.verify(new ValidateRoot({
        framework: 'ember',
        config: mockProject.project.config(),
        rootProps: ['baseURL', 'rootURL', 'baseUrl', 'rootUrl'],
        path: 'config/environment.js',
        force: true
      }));
    });

    it('skips non-glimmer validations if isGlimmer === true', function() {
      let framework = initFramework();
      framework.isGlimmer = true;

      let validators = framework._buildValidators({});

      expect(validators.length).to.equal(0);
    });
  });


  it('afterInstall runs UpdateWatchman and InstallEmberAddon', function() {
    let tasks = [];

    td.replace(WatchmanCfg.prototype, 'run', function() {
      tasks.push('update-watchman-config');
      return Promise.resolve();
    });

    td.replace(InstallPackage.prototype, 'run', function() {
      tasks.push('install-package');
      return Promise.resolve();
    });

    let framework = initFramework();

    return framework.afterInstall().then(function() {
      expect(tasks).to.deep.equal([
        'update-watchman-config',
        'install-package'
      ]);
    });
  });

  it('afterInstall runs InstallPackage with livereload addon', function() {
    let installedPackage;
    td.replace(InstallPackage.prototype, 'run', function(name) {
      installedPackage = name;
      return Promise.resolve();
    });

    td.replace(WatchmanCfg.prototype, 'run', function() {
      return Promise.resolve();
    });

    let framework = initFramework();

    return framework.afterInstall().then(function() {
      expect(installedPackage).to.equal('corber-ember-livereload');
    });
  });
});
