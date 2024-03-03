#!/bin/sh

./clean_test.sh

cyk module upload test/db/t20.xml
cyk module upload test/db/t22.xml

cyk test test/db/dbinit.xml

source ./.env

psql -h $PGHOST -p $PGPORT -f test/db/t_load_cache.sql

cyk test test/db/t*.xml

cyk test test/t*.xml

