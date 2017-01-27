#!/bin/sh

echo "Beginning Tauchan installation prerequisites setup."
echo "Installation order: PostgreSQL, GraphicsMagick, Redis, FFMpeg, Nodejs"
# sleep 3
# TWD=$PWD
# sudo adduser tauchan sudo
# echo "--------------------------------------"
# echo "Installing initial package dependencies"
# echo "--------------------------------------"
# sudo apt-get install -y build-essential
# sudo apt-get install -y tcl8.5

# echo "--------------------------------------"
# echo "Installing the PostgreSQL dependencies..."
# echo "--------------------------------------"
# sleep 3
# sudo service postgresql start
# pver=$( psql --version | sed -n 's/.* \([0-9.]*\)\.[0-9]*/\1/p' - )
# fver="9.6"
# sudo service postgresql stop
# if [ "$pver" != $fver ]; then
#     sudo apt-get -y --force-yes --purge remove postgresql-$pver
#     sudo apt-get -y --force-yes --purge remove postgresql-contrib-$pver
# fi
# if [ ! -f /etc/apt/sources.list.d/pgdg.list ] || [ $(sudo cat /etc/apt/sources.list.d/pgdg.list | grep 'apt.postgresql.org') != "" ]; then
#     sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'
#     wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
# fi
# sudo apt-get update
# sudo apt-get install -y --force-yes postgresql-$fver postgresql-contrib-$fver
# PGDATA="/data/postgresql/$fver"
# mkdir -p /data/postgresql/$fver
# export PGDATA
# initdb
# sudo sed -i "s/\(local *all *postgres *\)\w*/\1trust/g" /etc/postgresql/$fver/main/pg_hba.conf
# sudo sed -i "$ a local   all             tauchan                                trust" /etc/postgresql/$fver/main/pg_hba.conf

# sudo service postgresql start
# psql -f "./install/setup.sql" -U postgres

# echo "------------------------------------------"
# echo "Installing the GraphicsMagick dependencies..."
# echo "------------------------------------------"
# sleep 3
# pver="1.3.25"
# mkdir -p /tmp/gm
# wget https://sourceforge.net/projects/graphicsmagick/files/graphicsmagick/$pver/GraphicsMagick-$pver.tar.gz/download -O /tmp/gm-$pver.tar.gz
# tar -xzf /tmp/gm-$pver.tar.gz -C /tmp/gm --strip-components=1 && unlink /tmp/gm-$pver.tar.gz
# cd /tmp/gm && ./configure
# make
# sudo make install

# echo "----------------------------------"
# echo "Installing the Redis dependencies..."
# echo "Dependency tests can take 5-10 minutes to complete."
# echo "----------------------------------"
# sleep 3
# pver="3.2.6"
# mkdir -p /tmp/redis
# wget http://download.redis.io/releases/redis-$pver.tar.gz -O /tmp/redis-$pver.tar.gz
# tar -xvzf /tmp/redis-$pver.tar.gz -C /tmp/redis --strip-components=1 && unlink /tmp/redis-$pver.tar.gz
# cd /tmp/redis && make
# sudo make install

echo "---------------------"
echo "Installing node dependencies"
echo "---------------------"
pver="6"
if [ $( node --version ) ] && [ $( node --version | sed -n 's/v\([0-9]\)*\.[0-9]*\.[0-9]*/\1/p' ) != $pver ]; then
    if [ $( node --version ) != "" ]; then
        sudo apt-get -y --purge remove nodejs
    fi
    curl -sL https://deb.nodesource.com/setup_$pver.x | sudo -E bash -
    sudo apt-get install nodejs
    alias node="nodejs"
fi
# cd $TWD && npm install

echo "Installation prerequisites setup has completed." 