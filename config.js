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
var cfg = yml.read.sync('./conf/config.yml');
const pgp = PgPromise({capSQL:true});
const db = pgp(cfg.database);
var sql = yml.read.sync('./sql.yml');
var flags = yml.read.sync('./flags.yml');
var errors = yml.read.sync('./errors.yml');
var cwd = process.cwd();


const env = cfg.devmode? 'development' : process.env.NODE_ENV||'production';

// import Monitor from 'pg-monitor';
// Monitor.attach(pgpopts);

var cdn;
if (cfg.values.cdn_domain == 'localhost') cdn = '';
else if (cfg.values.cdn_domain.indexOf('://')<0)
	cdn = cfg.values.cdn_domain?'//'+cfg.values.cdn_domain:'';

const configs = {
    yml,cfg,sql,pgp,db,flags,errors,cdn,env,cwd,
    reload: ()=>{
		this.cfg = yml.read.sync('./conf/config.yml');
		this.sql = yml.read.sync('./sql.yml');
		this.flags = yml.read.sync('./flags.yml');
		this.errors = yml.read.sync('./errors.yml');
    }
};

module.exports = configs;
// export {configs as Config};
// export {configs as default};
