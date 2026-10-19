-- The contract price in force for each centre, for the API (ADR-0009). Flyway
-- runs this as clearcare_owner (ADR-0010).
--
-- A centre's price is a series: one row per published list (db/V8). The API
-- shows one price, so the view keeps the newest of them: the latest list date,
-- and then the latest version of that date.
CREATE VIEW clearcare.centre_contract_price AS
SELECT DISTINCT ON (contract_price.centre_id)
    contract_price.centre_id,
    contract_price.price
FROM clearcare.contract_price
INNER JOIN clearcare.contract_price_list
    ON contract_price_list.id = contract_price.list_id
ORDER BY
    contract_price.centre_id,
    contract_price_list.record_date DESC,
    contract_price_list.version DESC,
    contract_price.id DESC;

-- The API reads this view and nothing behind it, as with the views in db/V3.
GRANT SELECT ON clearcare.centre_contract_price TO clearcare_api;
