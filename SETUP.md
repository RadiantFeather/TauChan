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

The script will at times prompt for user input in the terminal. If it is a `y/n` question,
simply type `y` and press enter. If it asks for a value, you can just press `Enter`
to continue with the default if you don't have another value you know you need.