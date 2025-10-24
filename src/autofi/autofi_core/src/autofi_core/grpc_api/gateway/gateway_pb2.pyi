from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class Empty(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class EthereumSignRequest(_message.Message):
    __slots__ = ("path", "address", "chain_id", "transaction_type", "transaction_data")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ADDRESS_FIELD_NUMBER: _ClassVar[int]
    CHAIN_ID_FIELD_NUMBER: _ClassVar[int]
    TRANSACTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    TRANSACTION_DATA_FIELD_NUMBER: _ClassVar[int]
    path: str
    address: str
    chain_id: str
    transaction_type: int
    transaction_data: bytes
    def __init__(self, path: _Optional[str] = ..., address: _Optional[str] = ..., chain_id: _Optional[str] = ..., transaction_type: _Optional[int] = ..., transaction_data: _Optional[bytes] = ...) -> None: ...

class EthereumSignReply(_message.Message):
    __slots__ = ("signed_transaction",)
    SIGNED_TRANSACTION_FIELD_NUMBER: _ClassVar[int]
    signed_transaction: bytes
    def __init__(self, signed_transaction: _Optional[bytes] = ...) -> None: ...

class SignDataRequest(_message.Message):
    __slots__ = ("path", "address", "hash")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ADDRESS_FIELD_NUMBER: _ClassVar[int]
    HASH_FIELD_NUMBER: _ClassVar[int]
    path: str
    address: str
    hash: bytes
    def __init__(self, path: _Optional[str] = ..., address: _Optional[str] = ..., hash: _Optional[bytes] = ...) -> None: ...

class SignDataReply(_message.Message):
    __slots__ = ("signature",)
    SIGNATURE_FIELD_NUMBER: _ClassVar[int]
    signature: bytes
    def __init__(self, signature: _Optional[bytes] = ...) -> None: ...

class InitializeRequest(_message.Message):
    __slots__ = ("mnemonic",)
    MNEMONIC_FIELD_NUMBER: _ClassVar[int]
    mnemonic: str
    def __init__(self, mnemonic: _Optional[str] = ...) -> None: ...

class InitializeReply(_message.Message):
    __slots__ = ("status",)
    STATUS_FIELD_NUMBER: _ClassVar[int]
    status: int
    def __init__(self, status: _Optional[int] = ...) -> None: ...

class GetAddressRequest(_message.Message):
    __slots__ = ("path",)
    PATH_FIELD_NUMBER: _ClassVar[int]
    path: str
    def __init__(self, path: _Optional[str] = ...) -> None: ...

class GetAddressReply(_message.Message):
    __slots__ = ("address",)
    ADDRESS_FIELD_NUMBER: _ClassVar[int]
    address: str
    def __init__(self, address: _Optional[str] = ...) -> None: ...
