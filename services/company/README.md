##
docker cp D:/projects/LogisticERPSystem/scripts/init-company-schema.sql postgres_ERP:/tmp/schema.sql

##
docker exec postgres_ERP psql -U postgres -d company_db -f /tmp/schema.sql