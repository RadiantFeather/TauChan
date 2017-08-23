#!/bin/sh

echo "Beginning Tauchan installation prerequisites setup."
if [ "$1" != "--manual" ]; then
    echo "Installation order: PostgreSQL, GraphicsMagick, Redis, FFMpeg, Nodejs"
fi
sleep 3
TWD=$PWD
if [ "$1" != "--manual" ]; then
    echo "--------------------------------------"
    echo "Installing initial package dependencies"
    echo "--------------------------------------"
    sudo apt-get update
    sudo apt-get install -y autoconf automake build-essential libtool texinfo
fi

if [ "$1" != "--manual" ] || [ "$2" = "pgsql" ]; then
    echo "--------------------------------------"
    echo "Installing the PostgreSQL dependencies..."
    echo "--------------------------------------"
    sleep 3
    sudo service postgresql start
    pver=$( psql --version | sed -n 's/.* \([0-9.]*\)\.[0-9]*$/\1/p' - )
    sudo service postgresql stop
    fver="9.6"
    if [ "$pver" != "$fver" ]; then
        sudo apt-get -y --force-yes --purge remove postgresql-$pver
        sudo apt-get -y --force-yes --purge remove postgresql-contrib-$pver
    fi
    if [ ! -f /etc/apt/sources.list.d/pgdg.list ] || [ "_$(sudo cat /etc/apt/sources.list.d/pgdg.list | grep 'apt.postgresql.org')" != "_" ]; then
        sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    fi
    sudo apt-get update

    PGDATA="/data/postgresql/$fver"
    mkdir -p /data/postgresql/$fver
    export PGDATA
    sudo apt-get install -y --force-yes postgresql-$fver postgresql-contrib-$fver
    sudo service postgresql stop

    sudo sed -i "s/\(local *all *postgres *\)\w*/\1trust/g" /etc/postgresql/$fver/main/pg_hba.conf
    sudo sed -i "$ a local    all             tauchan                                 trust" /etc/postgresql/$fver/main/pg_hba.conf
    sudo sed -i "$ a local    replication     tauchan                                 trust" /etc/postgresql/$fver/main/pg_hba.conf
    sudo sed -i "$ a host     all             tauchan         127.0.0.1/32            md5" /etc/postgresql/$fver/main/pg_hba.conf
    sudo sed -i "$ a host     replication     tauchan         ::1/128                 md5" /etc/postgresql/$fver/main/pg_hba.conf
    
    sudo service postgresql start
    psql -U postgres -f "./install/setup.sql"
fi


if [ "$1" != "--manual" ] || [ "$2" = "gm" ]; then
    echo "------------------------------------------"
    echo "Installing the GraphicsMagick dependencies..."
    echo "------------------------------------------"
    sleep 3
    pver="1.3.25"
    mkdir -p /tmp/gm
    wget https://sourceforge.net/projects/graphicsmagick/files/graphicsmagick/$pver/GraphicsMagick-$pver.tar.gz/download -O /tmp/gm-$pver.tar.gz
    tar -xzf /tmp/gm-$pver.tar.gz -C /tmp/gm --strip-components=1 && unlink /tmp/gm-$pver.tar.gz
    cd /tmp/gm && ./configure
    make
    sudo make install
fi

if [ "$1" != "--manual" ] || [ "$2" = "redis" ]; then
    echo "----------------------------------"
    echo "Installing the Redis dependencies..."
    echo "----------------------------------"
    sleep 3
    pver="3.2.8"
    mkdir -p /tmp/redis
    wget http://download.redis.io/releases/redis-$pver.tar.gz -O /tmp/redis-$pver.tar.gz
    tar -xvzf /tmp/redis-$pver.tar.gz -C /tmp/redis --strip-components=1 && unlink /tmp/redis-$pver.tar.gz
    cd /tmp/redis && make
    sudo make install
fi


if [ "$1" != "--manual" ] || [ "$2" = "ffmpeg" ]; then
    
    echo "------------------------------"
    echo "Installing FFMpeg dependencies..."
    echo "------------------------------"
    sudo apt-get install -y tcl8.5
    sudo add-apt-repository -y ppa:jonathonf/ffmpeg-3
    sudo apt update
    sudo apt install -y ffmpeg libav-tools x264 x265 libmp3lame0
fi

if [ "$1" != "--manual" ] || [ "$2" = "node" ]; then
    echo "----------------------------"
    echo "Installing node dependencies..."
    echo "----------------------------"
    cd $TWD
    pver="8"
    if [ "_$NVM_DIR" != "_" ]; then # if NVM is present, remove
        rm -rf $NVM_DIR/
        sed -i 's/\(.*nvm.*\)//g' ~/.profile
        export PATH="$( echo $PATH | sed 's|:*[^:]*nvm[^:]*:*|:|' )"
    fi                            # else use apt-get
    if [ "_$( nodejs --version )" != "_" ]; then
        sudo apt-get -y --purge remove nodejs
        sudo apt-get -y autoremove
    fi
    curl -sL https://deb.nodesource.com/setup_$pver.x | sudo -E bash -
    sudo apt-get -y install nodejs
    if [ -e /usr/bin/node ]; then
        sudo rm /usr/bin/node
    fi
    sudo ln -s /usr/bin/nodejs /usr/bin/node
    echo "Node version: $( nodejs --version )"
    npm install
fi

if [ "$1" != "--manual" ] || [ "$2" = "pgsql" ]; then
    echo "Please enter a password for the site's database use: "
    read pass
    psql -U postgres -c "ALTER USER tauchan WITH ENCRYPTED PASSWORD '$pass';"
fi