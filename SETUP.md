# Pre-installation Setup Instructions

#### Set the working directory to the site's root folder and run `. setup.sh` in the terminal. Make sure to include the period and space.

If a popup occurs in the terminal, select the option: "install the package maintainer's version"

**This setup script assumes that the site is being**
**installed onto its own container or instance of Ubuntu/Debian.**

If you want to setup the site in a shared space or another linux dist, it is recommended to manually
install the following prerequisites as needed:
- Nodejs 7.9.x or newer (MUST have ES7 features like async/await)
- PostgreSQL 9.6.x or newer
- Redis 3.2.x
- GraphicsMagick 1.3.x

#### If you install the prerequisites manually, you will need to run `. setup.sh --manual` in the root folder. Make sure to include the period and space.