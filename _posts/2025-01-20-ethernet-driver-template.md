---
layout: post
title: Ethernet Driver Bring-up Template
date: 2025-01-20 09:00:00
description: Starter template for documenting Ethernet driver bring-up and testing.
tags: ethernet
---

Use this template to capture bring-up steps, register notes, and test results for Ethernet work.

## Context
- Target SoC:
- PHY:
- Board revision:

## Goals
- Establish link and verify auto-negotiation
- Send and receive frames via DMA
- Validate throughput and latency expectations

## Bring-up Checklist
1. Confirm clocking and reset wiring
2. Verify MDIO access to the PHY
3. Configure MAC address and DMA rings
4. Enable RX/TX and confirm interrupts

## Driver Notes
Record register addresses, bitfields, and any errata here.

```c
// Minimal RX descriptor initialization (example)
for (int i = 0; i < RX_RING_SIZE; i++) {
  rx_desc[i].addr = rx_buffers[i];
  rx_desc[i].status = DESC_OWNED_BY_HW;
}
```

## Tests
- Link up/down cycling
- Ping and iperf validation
- Packet loss under load

## Next Steps
- Add a PHY-specific tuning section
- Document DMA cache maintenance steps
