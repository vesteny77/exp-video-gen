# SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES. 
# All rights reserved. # SPDX-License-Identifier: Apache-2.0 # 
# # Licensed under the Apache License, Version 2.0 (the "License"); 
# # you may not use this file except in compliance with the License. 
# # You may obtain a copy of the License at # 
# # http://www.apache.org/licenses/LICENSE-2.0 # 
# # Unless required by applicable law or agreed to in writing, software 
# # distributed under the License is distributed on an "AS IS" BASIS, 
# # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
# # See the License for the specific language governing permissions and 
# # limitations under the License.

import argparse
import asyncio

from .a2f.client.auth import *
from .a2f.client.service import *
from nvidia_ace.services.a2f_controller.v1_pb2_grpc import A2FControllerServiceStub
from typing import List, Tuple, Optional

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
                        description="Sample python application to send audio and receive animation data and emotion data through the Audio2Face API.",
                        epilog="NVIDIA CORPORATION.  All rights reserved.")
    parser.add_argument("file", help="PCM-16 bits single channel audio file in WAV container to be sent to the Audio2Face service")
    parser.add_argument("config", help="Configuration file for inference models")
    # parser.add_argument("--apikey", type=str, required=True, help="NGC API Key to invoke the API function")
    # parser.add_argument("--function-id", type=str, required=True, default="", help="Function ID to invoke the API function")
    return parser.parse_args()

async def run(file: str, config: str, metadata_args: Optional[List[Tuple[str, str]]] = None) -> None:
    """
    Async entrypoint to call the Audio2Face service.
    - file: path to PCM-16 WAV file
    - config: path to config file
    - metadata_args: optional list of (key, value) metadata pairs for the channel
    """
    # Provide default metadata if not given (same as original script).
    # WARNING: avoid hard-coding secrets/tokens in code. Prefer passing them in.
    if metadata_args is None:
        metadata_args = [
            ("function-id", "0961a6da-fb9e-4f2e-8491-247e5fd7bf8d"),
            ("authorization", "Bearer " + "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")
        ]

    # Open gRPC channel and get Audio2Face stub
    channel = create_channel(uri="grpc.nvcf.nvidia.com:443", use_ssl=True, metadata=metadata_args)
    stub = A2FControllerServiceStub(channel)

    stream = stub.ProcessAudioStream()
    write_task = asyncio.create_task(write_to_stream(stream, config, file))
    read_task = asyncio.create_task(read_from_stream(stream))

    await write_task
    csv_path=await read_task
    return csv_path

def run_sync(file: str, config: str, metadata_args: Optional[List[Tuple[str, str]]] = None) -> None:
    """
    Synchronous wrapper for calling run() from non-async code.
    """
    asyncio.run(run(file, config, metadata_args))

if __name__ == "__main__":
    args = parse_args()
    # If you want to override metadata when running from CLI, modify here or extend parse_args
    asyncio.run(run(args.file, args.config))
