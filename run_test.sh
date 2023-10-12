#!/bin/sh

./clean_test.sh

cyk module upload test/db/t20.xml
cyk module upload test/db/t22.xml

cyk test test/db/t*.xml

cyk test test/t*.xml

