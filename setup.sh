#!/bin/bash

echo "Beginning Tauchan installation prerequisites setup."
echo "Installation order: PostgreSQL, GraphicsMagick, Redis, FFMpeg, Nodejs"
sleep 3
TWD=$PWD
echo "--------------------------------------"
echo "Installing initial package dependencies"
echo "--------------------------------------"
sudo apt-get install build-essential
sudo apt-get install tcl8.5
echo "--------------------------------------"
echo "Installing the PostgreSQL dependencies..."
echo "--------------------------------------"
sleep 3
sudo service postgresql start
pver=$( psql --version | sed -n 's/.* \([0-9.]*\)\.[0-9]*/\1/p' - )
fver="9.6"
sudo service postgresql stop
if [ "$pver" != $fver ]; then
    sudo apt-get --purge remove postgresql-$pver
    sudo apt-get --purge remove postgresql-contrib-$pver
fi
if [ ! -f /etc/apt/sources.list.d/pgdg.list ] || [ "$(sudo cat /etc/apt/sources.list.d/pgdg.list | grep 'apt.postgresql.org')" != "" ]; then
    sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
fi
sudo apt-get update
sudo apt-get install postgresql-$fver postgresql-contrib-$fver
sudo sed -i "s/\(local *all *postgres *\)\w*/\1trust/g" /etc/postgresql/$fver/main/pg_hba.conf
sudo sed -i "$ a local   all             tauchan                                trust" /etc/postgresql/$fver/main/pg_hba.conf

sudo service postgresql start
psql -f "./install/setup.sql"
psql -c "CREATE ROLE tauchan ENCRYPTED PASSWORD 'md58040ed7558a08902c52968aafa41a559' NOSUPERUSER CREATEDB NOCREATEROLE INHERIT LOGIN;"
# UNENCRYPTED PASSWORD 'tauchan'
createdb tauchan

# echo "------------------------------------------"
# echo "Installing the GraphicsMagick dependencies..."
# echo "Dependency downloading can take 5-10 minutes to complete. Please be patient."
# echo "------------------------------------------"
# sleep 3
# mkdir -p /tmp/gm
# wget ftp://ftp.graphicsmagick.org/pub/GraphicsMagick/1.3/GraphicsMagick-1.3.25.tar.gz -O /tmp/gm-1.3.25.tar.gz
# tar -xzf /tmp/gm-latest.tar.gz -C /tmp/gm --strip-components=1 && unlink /tmp/gm-1.3.25.tar.gz
# cd /tmp/gm && ./configure
# make
# make check
# sudo make install

# echo "----------------------------------"
# echo "Installing the Redis dependencies..."
# echo "Dependency tests can take 5-10 minutes to complete."
# echo "There will be a couple times where user interaction is needed. Please stand by."
# echo "----------------------------------"
# sleep 3

# mkdir -p /tmp/redis
# wget http://download.redis.io/releases/redis-3.2.6.tar.gz -O /tmp/redis-3.2.6.tar.gz
# tar -xvzf /tmp/redis-3.2.6.tar.gz -C /tmp/redis --strip-components=1 && unlink /tmp/redis-3.2.6.tar.gz
# cd /tmp/redis && make
# make test
# sudo make install
# echo "-----------------------"
# echo "Installing the Redis Server. Just pressing Enter to accept the defaults for now."
# cd utils && sudo ./install_server.sh
# sudo update-rc.d redis_6379 defaults

# mkdir -p /tmp/psql
# wget https://ftp.postgresql.org/pub/source/v9.5.5/postgresql-9.5.5.tar.gz -O /tmp/psql-9.5.5.tar.gz
# tar -xvzf /tmp/psql-9.5.5.tar.gz -C /tmp/psql --strip-components=1 && unlink /tmp/redis-3.2.6.tar.gz
# cd /tmp/psql && ./configure
# make world
# make check
# sudo make install-world

# echo "---------------------"
# echo "Installing node dependencies"
# echo "---------------------"
# curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
# sudo apt-get install nodejs
# cd $TWD && npm install

echo "Installation prerequisites setup has completed." 