"""The dispatcher's settings, read from the environment.

Two switches decide what a pass does. ``CLEARCARE_ALERTS`` is the gate, the
variable the deployed Terraform passes (CCARE-269): off runs the dispatcher
and consumes the events silently, so a deployment never emails until the
site is ready, and on sends. What actually sends when the gate is open is
``CLEARCARE_ALERTS_SENDER``, which defaults to ``ses`` (the deployment's intent)
and takes ``log`` as the development override. A gate that is open without
a site address, a Cognito pool or a From line for ses fails the stage
loudly rather than quietly emailing nothing, which would look like success.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass

# The gate the deployment flips when the site is ready for email, the
# switch the deployed Terraform passes to the pipeline task (CCARE-269).
# Default off: every environment starts inert, and a forgotten variable
# cannot email anybody.
SEND_VARIABLE = "CLEARCARE_ALERTS"

# Which sender a gate that is open uses. It defaults to ses, the value the
# deployment means when it flips the gate; log is the development override.
SENDER_VARIABLE = "CLEARCARE_ALERTS_SENDER"

# The site's public address, no trailing slash, for the links in the body
# and for the unsubscribe link. Unset while the gate is closed.
SITE_URL_VARIABLE = "CLEARCARE_SITE_URL"

# The From line the SES sender sends with, the variable the deployed
# Terraform sets. Required only for sender ses.
FROM_VARIABLE = "CLEARCARE_ALERTS_FROM"

# Cognito, for the address of each account. The region is the account's
# (eu-north-1, infra/aws/README.md), overridable for a test account elsewhere.
POOL_VARIABLE = "CLEARCARE_COGNITO_USER_POOL_ID"
REGION_VARIABLE = "CLEARCARE_AWS_REGION"
DEFAULT_REGION = "eu-north-1"

LOG = "log"
SES = "ses"
SENDERS = (LOG, SES)


class SettingsError(Exception):
    """A setting is missing or misspelled; the stage refuses to run."""


@dataclass(frozen=True)
class Settings:
    """What one dispatch pass needs to know about its deployment."""

    send_enabled: bool
    sender: str | None
    site_url: str | None
    from_address: str | None
    user_pool_id: str | None
    region: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        """Reads the settings, rejecting what would email nothing."""
        environment = dict(os.environ if env is None else env)
        raw = (environment.get(SEND_VARIABLE) or "").strip().lower()
        if raw not in ("", "on", "off"):
            raise SettingsError(f"{SEND_VARIABLE} is {raw!r}; it is on or off")
        send_enabled = raw == "on"
        # An open gate means real sends: the sender defaults to ses, and a
        # development run overrides it to log.
        sender = (environment.get(SENDER_VARIABLE) or SES).strip().lower()
        if sender not in SENDERS:
            raise SettingsError(
                f"{SENDER_VARIABLE} is {sender!r}; it is {LOG} or {SES}"
            )
        if not send_enabled:
            # The gate is closed: the pass consumes events and sends nothing,
            # so the send settings may stay unset.
            return cls(
                send_enabled=False,
                sender=None,
                site_url=None,
                from_address=None,
                user_pool_id=environment.get(POOL_VARIABLE) or None,
                region=environment.get(REGION_VARIABLE) or DEFAULT_REGION,
            )
        missing = [
            name
            for name, value in (
                (SITE_URL_VARIABLE, environment.get(SITE_URL_VARIABLE)),
                (POOL_VARIABLE, environment.get(POOL_VARIABLE)),
            )
            if not value
        ]
        if sender == SES and not environment.get(FROM_VARIABLE):
            missing.append(FROM_VARIABLE)
        if missing:
            raise SettingsError(
                f"{SEND_VARIABLE} is on, so these are required: "
                + ", ".join(missing)
            )
        site_url = (environment.get(SITE_URL_VARIABLE) or "").rstrip("/")
        return cls(
            send_enabled=True,
            sender=sender,
            site_url=site_url,
            from_address=environment.get(FROM_VARIABLE) or None,
            user_pool_id=environment.get(POOL_VARIABLE) or None,
            region=environment.get(REGION_VARIABLE) or DEFAULT_REGION,
        )


@dataclass(frozen=True)
class Links:
    """The URL shapes of the site, as the emails spell them.

    The centre pages are the site's own (web/clearcare/app/(site)/centres),
    a county's list is the search page filtered to it, and the unsubscribe
    link is the route the site's alerts endpoints will serve (CCARE-270):
    one shape, agreed here and used by the dispatcher's emails.
    """

    site_url: str

    def centre(self, centre_id: str) -> str:
        """The page of one centre."""
        return f"{self.site_url}/centres/{centre_id}"

    def centre_inspections(self, centre_id: str) -> str:
        """The inspections page of one centre, where new reports land."""
        return f"{self.site_url}/centres/{centre_id}/inspections"

    def county(self, name: str) -> str:
        """The search page filtered to one county, newest inspections first."""
        return f"{self.site_url}/search?county={name}&sort=latest_inspection"

    def search_all(self) -> str:
        """The search page over every centre, newest inspections first."""
        return f"{self.site_url}/search?sort=latest_inspection"

    def unsubscribe(self, token: str) -> str:
        """The signed-out link that cancels every subscription."""
        return f"{self.site_url}/alerts/unsubscribe?token={token}"
