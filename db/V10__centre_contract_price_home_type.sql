-- The contract price in force for each centre, and the kind of home it is for
-- . Flyway runs this as clearcare_owner (ADR-0010).
CREATE OR REPLACE VIEW clearcare.centre_contract_price AS
SELECT DISTINCT ON (contract_price.centre_id)
    contract_price.centre_id,
    contract_price.price,
    contract_price_list.home_type
FROM clearcare.contract_price
INNER JOIN clearcare.contract_price_list
    ON contract_price_list.id = contract_price.list_id
ORDER BY
    contract_price.centre_id,
    contract_price_list.record_date DESC,
    contract_price_list.version DESC,
    contract_price.id DESC;
