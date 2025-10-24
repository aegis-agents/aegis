from __future__ import annotations

import grpc
from autofi_core.grpc_api.gateway import (VaultServiceStub, GetAddressRequest, GetAddressReply,
                                                          SignDataRequest, SignDataReply)
from .const import CA_CERT_PATH, CLIENT_KEY_PATH, CLIENT_CERT_PATH


class VaultGrpcClient:
    channel: grpc.Channel | None = None
    stub: VaultServiceStub | None = None

    @staticmethod
    def construct(grpc_server: str) -> VaultGrpcClient:
        client = VaultGrpcClient()
        with open(CA_CERT_PATH, 'rb') as f:
            trusted_cert = f.read()
        with open(CLIENT_CERT_PATH, 'rb') as f:
            client_cert = f.read()
        with open(CLIENT_KEY_PATH, 'rb') as f:
            client_key = f.read()

        credentials = grpc.ssl_channel_credentials(
            root_certificates=trusted_cert,
            private_key=client_key,
            certificate_chain=client_cert,
        )

        client.channel = grpc.secure_channel(grpc_server, credentials)
        client.stub = VaultServiceStub(client.channel)
        return client

    def get_address(self, path: str) -> str:
        resp: GetAddressReply = self.stub.GetAddress(GetAddressRequest(path=path))
        return resp.address

    def sign_data(self, path: str, address: str, data: bytes) -> bytes:
        resp: SignDataReply = self.stub.SignData(SignDataRequest(path=path, address=address, hash=data))
        return resp.signature
