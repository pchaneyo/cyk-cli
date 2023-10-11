#!/bin/sh

cyk table drop -y t_film_actor
cyk table drop -y t_film
cyk table drop -y t_actor

cyk module upload test/db/t20.xml
cyk module upload test/db/t22.xml

cyk test test/db/t*.xml

