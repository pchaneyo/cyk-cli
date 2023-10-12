#!/bin/sh

cyk table drop -y t_film_actor
cyk table drop -y t_film
cyk table drop -y t_actor


psql -c "
do \$\$
declare next_id int;
begin
select max(table_id)+1 from cyk_table into next_id;
execute 'alter sequence cyk_table_table_id_seq restart with ' || next_id ;
end \$\$
"





