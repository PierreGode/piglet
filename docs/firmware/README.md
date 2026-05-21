# Firmware binaries

Place compiled `.bin` files here:

- `piglet-esp32s3.bin` — Piglet Core for XIAO ESP32-S3
- `piglet-esp32c5.bin` — Piglet Core for XIAO ESP32-C5
- `piglet-esp32c6.bin` — Piglet Core for XIAO ESP32-C6
- `pigletnode-esp32c5.bin` — PigletNode mesh node for XIAO ESP32-C5
- `tdongle-c5-piglet.bin` — T-Dongle C5 standalone variant

These are referenced by the manifest JSON files in the `docs/` root.
Generate them from Arduino IDE using `Sketch → Export Compiled Binary` or via CI.
