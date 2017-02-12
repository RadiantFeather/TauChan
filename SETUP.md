# Pre-installation Setup Instructions

#### Set the working directory to the site's root folder and run `./setup.sh` in the terminal.

If a popup occurs in the terminal, select the option: "install the package maintainer's version"

**This setup script assumes that the site is being**
**installed onto its own container or instance of linux.**

If you want to setup the site in a shared space, it is recommended to manually
install the following prerequisites as needed:
- Nodejs 6.9.x or newer (MUST have ES6 features)
- PostgreSQL 9.5.x or newer
- Redis 3.2.x
- GraphicsMagick 1.3.x

#### If you install the prerequisites manually, you will need to run `./setup.sh --manual` in the root folder