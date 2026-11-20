"""The account's address, resolved from Cognito at send time (ADR-0034).

The database holds the account's Cognito subject and nothing else, so the
dispatcher asks Cognito who to write to, once per account per pass. An
account Cognito does not know, or that carries no email address, resolves to
None: the receipt is marked skipped and never retried. A Cognito that is
down raises, and the send attempt fails like any other, retried with the
send.
"""

import logging
from typing import TYPE_CHECKING, Protocol

from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from mypy_boto3_cognito_idp import CognitoIdentityProviderClient

logger = logging.getLogger(__name__)


class Addresses(Protocol):
    """Who the dispatcher writes to, one question per account."""

    def address(self, cognito_sub: str) -> str | None:
        """The account's email address, or None when Cognito has none."""
        ...


class AddressBook:
    """The addresses of the accounts one pass writes to, asked once each."""

    def __init__(
        self, client: "CognitoIdentityProviderClient", user_pool_id: str
    ) -> None:
        """Creates the book over one Cognito client and its user pool."""
        self._client = client
        self._pool = user_pool_id
        self._addresses: dict[str, str | None] = {}

    def address(self, cognito_sub: str) -> str | None:
        """The account's email address, or None when Cognito has none.

        The result is remembered for the pass, so a digest for an account
        whose receipts cover several runs asks Cognito once.
        """
        if cognito_sub not in self._addresses:
            self._addresses[cognito_sub] = self._ask(cognito_sub)
        return self._addresses[cognito_sub]

    def _ask(self, cognito_sub: str) -> str | None:
        try:
            user = self._client.admin_get_user(
                UserPoolId=self._pool, Username=cognito_sub
            )
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in ("UserNotFoundException", "UserNotFound"):
                logger.warning(
                    "no Cognito account for a subject; its receipts are skipped"
                )
                return None
            raise
        attributes = {
            item["Name"]: item.get("Value") or ""
            for item in user.get("UserAttributes") or ()
        }
        address = attributes.get("email")
        if not address:
            logger.warning("a Cognito account carries no email address")
            return None
        return str(address)
