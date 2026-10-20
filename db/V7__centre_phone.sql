-- The centre's phone number, and the view the API reads with it. Flyway runs
-- this as clearcare_owner (ADR-0010).

-- db/V1 left out all three phone columns of the register as personal data.
-- Centre_Phone is the centre's own line, which HIQA prints on the centre's
-- public page, so it is loaded: the register's data about the centre and its
-- registered provider is loaded, and its data about individual staff is not.
-- Person_in_Charge, Person_in_Charge_Phone, Registration_Provider_Phone and
-- Management_Contacts stay out. Stored as printed, which is not always one
-- number. Rows loaded before this migration have NULL.
ALTER TABLE clearcare.register_entry ADD COLUMN centre_phone text;

-- As in db/V1, with centre_phone added at the end. Replacing the view keeps
-- its grant to clearcare_api.
CREATE OR REPLACE VIEW clearcare.centre_search AS
SELECT
    register_entry.centre_id,
    register_entry.centre_name,
    register_entry.address,
    register_entry.county,
    register_entry.eircode,
    register_entry.maximum_occupancy,
    register_entry.hiqa_url,
    clearcare.search_key(register_entry.centre_name) AS name_key,
    clearcare.search_key(register_entry.address) AS address_key,
    register_entry.centre_phone
FROM clearcare.register_entry
INNER JOIN clearcare.register_publication USING (source_file_id);
