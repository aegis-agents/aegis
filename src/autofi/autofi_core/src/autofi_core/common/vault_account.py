from eth_account.signers.base import BaseAccount
from .vault_client import VaultGrpcClient
from eth_account.datastructures import SignedMessage, SignedTransaction
from eth_account.messages import SignableMessage
from eth_typing import ChecksumAddress
from eth_utils import to_checksum_address
from eth_keys.datatypes import Signature
from hexbytes import HexBytes


class VaultAccount(BaseAccount):
    """
    A base class for accounts that are backed by a vault.
    This class should be extended to implement specific vault account types.
    """

    def __init__(self, conn: VaultGrpcClient, path: str, address: str = None):
        self.conn = conn
        self.path = path
        self.evm_address = address

    @property
    def address(self) -> ChecksumAddress:
        """
        The checksummed public address for this vault account.
        """
        if self.evm_address is not None:
            return to_checksum_address(self.evm_address)
        self.evm_address = self.conn.get_address(self.path)
        return to_checksum_address(self.evm_address)

    def sign_message(self, signable_message: SignableMessage) -> SignedMessage:
        raise NotImplementedError("Subclasses must implement this method.")

    def unsafe_sign_hash(self, message_hash: bytes) -> SignedMessage:
        if self.evm_address is None:
            self.evm_address = self.address
        hash_bytes = HexBytes(message_hash)
        sig_bytes = self.conn.sign_data(self.path, self.evm_address, hash_bytes)
        r = int.from_bytes(sig_bytes[0:32], byteorder="big")
        s = int.from_bytes(sig_bytes[32:64], byteorder="big")
        v_raw = sig_bytes[64]
        if v_raw in (0, 1):
            v = v_raw + 27
        else:
            v = v_raw
        fixed_signature_bytes = sig_bytes[:64] + bytes([v])
        return SignedMessage(
            message_hash=HexBytes(message_hash),
            signature=HexBytes(fixed_signature_bytes),
            r=r,
            s=s,
            v=v
        )

    def sign_transaction(self, transaction: dict) -> SignedTransaction:
        """
        Sign a transaction using the vault account.
        :param transaction:
        :return:
        """
        raise NotImplementedError("Subclasses must implement this method.")
