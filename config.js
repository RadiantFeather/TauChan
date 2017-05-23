const cwd = process.cwd();
//*/
const ReadYaml = require('read-yaml');
const WriteYaml = require('write-yaml');
const PgPromise = require('pg-promise');
/*/
import ReadYaml from 'read-yaml';
import WriteYaml from 'write-yaml';
import PgPromise from 'pg-promise';
//*/
//constants
const yml = {read: ReadYaml, write: WriteYaml};
  
// Configuations
var cfg;
try {
	cfg = yml.read.sync(cwd+'/conf/config.yml');
} catch (e){
	cfg = yml.read.sync(cwd+'/install/default.yml');
}
const pgp = PgPromise({capSQL:true});
const db = pgp(cfg.database);
var sql = yml.read.sync(cwd+'/sql.yml');
var flags = yml.read.sync(cwd+'/flags.yml');
var globalflags = yml.read.sync(cwd+'/flags.global.yml');
var errors = yml.read.sync(cwd+'/errors.yml');


const env = cfg.devmode? 'development' : process.env.NODE_ENV||'production';

// import Monitor from 'pg-monitor';
// Monitor.attach(pgpopts);

var cdn;
if (!cfg.options.use_external_cdn || cfg.values.cdn_domain == 'localhost') cdn = '';
else if (!cfg.values.cdn_domain.contains('://'))
	cdn = cfg.values.cdn_domain?'//'+cfg.values.cdn_domain:'';

const configs = {
    yml,cfg,sql,pgp,db,flags,globalflags,errors,cdn,env,cwd,
    reload: ()=>{
		this.cfg = yml.read.sync(cwd+'/conf/config.yml');
		this.sql = yml.read.sync(cwd+'/sql.yml');
		this.flags = yml.read.sync(cwd+'/flags.yml');
		this.globalflags = yml.read.sync(cwd+'/flags.global.yml');
		this.errors = yml.read.sync(cwd+'/errors.yml');
    }
};

module.exports = configs;
// export {configs as Config};
// export {configs as default};
