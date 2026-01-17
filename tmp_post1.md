# Post 1: ZC702 PS Ethernet over MIO and PS to PL AXI Loopback

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_1.png)
{: .img-fluid .rounded .z-depth-1 }

**Author(s):** Mostafa Elsanousi, Muhammad Farhan Azmine

**Publication Date:** TBD

**Target Board:** AMD/Xilinx ZC702 (xc7z020 Zynq-7000)  **Toolchain:** Vivado 2025.1, Vitis 2025.1 **Keywords:** Zynq, GEM0, Ethernet, MIO, RGMII, lwIP, UDP, AXI, AXI4-Lite, SmartConnect, GPIO

## Abstract

This project demonstrates a complete, minimal, and repeatable Zynq 7000 bring up flow on the ZC702 board in which the Processing System handles Ethernet networking entirely within the hard silicon, while the Programmable Logic implements a deliberately simple datapath that can be exercised from software through memory mapped registers. The design uses GEM0 Ethernet over the ZC702 onboard RGMII connection to the PHY and RJ45 jack, then uses the PS to PL AXI general purpose port to write a 32 bit value into the fabric and read back a transformed result. The transformation is intentionally trivial, a bitwise inversion, so correctness is unambiguous. On the software side, two complementary applications validate the system: a standard lwIP TCP echo server that confirms the Ethernet stack is operational, and a custom lwIP UDP service that performs a deterministic command response exchange by writing to and reading from the AXI GPIO registers in the PL.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_2.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 1: Full system block diagram showing PS Ethernet path and PS to PL register access path*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_3.png)
{: .img-fluid .rounded .z-depth-1 }

## Motivation and Goals

Zynq devices are most powerful when the boundary between software and hardware is treated as an interface you can reason about and verify. A common failure mode in early Zynq development is building a complex PL design before confirming that the basic fundamentals are correct: the PS boots reliably, Ethernet traffic reaches the board, the PS can access mapped PL peripherals, and resets and clocks are correctly applied to the fabric. This project is structured as a bring up and verification scaffold. It establishes a working Ethernet baseline on GEM0 and then proves a controlled PS to PL transaction path using AXI register reads and writes. If this minimal design works, later projects can safely replace the inverter datapath with more meaningful PL accelerators while reusing the same approach to software control and verification.

The primary success criterion is simple: a host computer sends a 32 bit word to the board, the PS writes it into a PL register, the PL inverts it, the PS reads the result, and the board responds with both the original and the inverted values. A secondary success criterion is that a generic TCP echo server can accept a connection and mirror back arbitrary bytes, confirming that the Ethernet link, IP configuration, and lwIP processing loop are stable.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_4.png)
{: .img-fluid .rounded .z-depth-1 }

## System architecture and responsibilities

A Zynq 7000 device combines two worlds in one package. The Processing System contains the ARM cores, memory controllers, and hardened peripherals such as the Gigabit Ethernet MAC. The Programmable Logic is the FPGA fabric where custom datapaths and peripherals are implemented.

In this project, the separation of responsibilities is intentional. The Processing System performs everything related to networking. It configures the Ethernet interface, runs lwIP, and implements application level protocols. The Programmable Logic performs only one operation: bitwise inversion of a 32 bit value. That operation is wrapped by two AXI GPIO peripherals so the PS can interact with it using ordinary memory mapped I/O.

This architecture yields a clean mental model. If Ethernet fails, the issue is within PS configuration, PHY link, IP settings, or lwIP software. If Ethernet works but PL access fails, the issue is within clocks, resets, address mapping, bitstream programming, or AXI interconnect wiring. Because the PL datapath is trivial, functional ambiguity is removed.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_5.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 2A: PS/PL partitioning: networking in PS, 32‑bit inverter datapath in PL with AXI GPIO wrappers*![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_6.png)

*Figure 2B: End‑to‑end data flow: UDP/TCP traffic in PS and AXI‑Lite MMIO to PL for [W][R] replies.*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_7.png)
{: .img-fluid .rounded .z-depth-1 }

## Ethernet on ZC702 and the MAC to PHY relationship

Ethernet on the ZC702 is implemented as a two chip partnership. The Zynq Processing System provides the MAC, which is responsible for framing, buffering, DMA style movement inside the PS, and presenting packets to software through a driver. The physical layer chip on the board provides the PHY, which is responsible for the analog signaling and the electrical interface to the cable through the RJ45 connector. The MAC and PHY communicate over a standardized digital interface. On the ZC702 that interface is RGMII for data and MDIO for management.

This matters for the bring-up because you can conceptually split the Ethernet problem into two parts. Link status and auto negotiation involve the PHY and the management interface. Packet handling in lwIP involves the MAC driver and the software stack. A working system requires both pieces to be correctly wired and configured.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_8.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 3: Conceptual MAC to PHY diagram showing RGMII data signals and MDIO management channel*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_9.png)
{: .img-fluid .rounded .z-depth-1 }

## Digital pin routing modes in Zynq: MIO and EMIO

A Zynq device offers two distinct ways to route PS peripheral signals to the outside world. Understanding this distinction is foundational for reliable board bring up, and it is especially important for Ethernet because the physical wiring on the board often dictates the correct choice.

### 4.1. What MIO is

MIO stands for Multiplexed I O. These are dedicated pins on the Zynq package that connect directly to hardened peripheral I/O inside the Processing System. When you route a PS peripheral through MIO, the signal path is strictly within the PS I/O subsystem and then out to the board pins. There is no dependence on the FPGA fabric for routing those peripheral signals. In practical terms, that means a MIO routed peripheral remains a PS native interface. It is configured through the PS configuration, and it does not require any PL logic to exist in order for the peripheral signals to reach the board.

This mode is ideal when the board designer has already wired a peripheral, such as Ethernet or UART, directly to the Zynq MIO pins and expects the hardened peripheral to drive those pins.

*![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_10.png)*

*Figure 4: Illustration of MIO routing showing a PS peripheral connected directly to package pins without traversing the PL*

### 

### 

### 4.2. What EMIO is

EMIO stands for Extended Multiplexed I O. In this mode, the PS peripheral signals do not go directly to package pins. Instead, the PS exposes those signals internally to the Programmable Logic, and the PL then routes them through FPGA fabric resources to chosen external pins or to internal logic. EMIO is therefore a PS peripheral routed through the PL. It introduces flexibility, because the PL can remap or condition signals and can bring PS peripherals out to pins that are not part of the fixed MIO set. However, it also introduces dependency: the PL must be configured and clocked correctly for those peripheral signals to reach the outside world.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_11.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 5: Illustration of EMIO routing showing a PS peripheral passing through the PL before reaching ext*ernal pins

### 4.3. Why Ethernet uses MIO on ZC702 in this project

On the ZC702, the onboard Ethernet PHY is physically wired to the Zynq GEM0 interface using the board’s fixed routing. Because the RGMII and MDIO connections are already matched to the Processing System’s dedicated Ethernet capable pins, the most direct and robust configuration is to use GEM0 over MIO. This avoids unnecessary dependence on PL routing for the networking path and aligns with the board’s intended usage. It also results in a simpler failure surface during bring up: if the PS is running, the Ethernet pins are driven by the hardened peripheral, independent of any custom PL logic.

EMIO Ethernet can be appropriate on other boards or designs, particularly when a PHY or external connector is routed to PL pins instead of PS pins, or when a design requires unusual pin mapping. In those cases, the Ethernet signals must be routed through the fabric. For the ZC702 onboard PHY path, MIO is the natural and tutorial friendly option.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_12.png)
{: .img-fluid .rounded .z-depth-1 }

## How the PS communicates with the PL: AXI GP, SmartConnect, and AXI-Lite

While Ethernet is kept entirely inside the PS, the purpose of the project is not only networking. The purpose is also to demonstrate a clean, software controlled PS to PL interface. In Zynq, that interface is typically AXI.

### 5.1. AXI Lite as register access

AXI is a family of bus protocols designed for high performance on chip communication. AXI Lite is a simplified subset intended for low bandwidth, memory mapped register interfaces. In practice, AXI Lite behaves like this: software running on the ARM writes a value to an address, and hardware in the PL interprets that write as a register update. Software then reads from another address, and hardware returns the current value of a register. This is exactly the semantics needed to control small peripherals such as GPIO blocks, control registers, and configuration interfaces.

In this project, the PS uses a memory mapped master port called the AXI general purpose port. Through that port, the PS can access addresses that are decoded to PL peripherals. Because AXI Lite is register oriented, the software side can be extremely simple. It can use ordinary 32 bit memory mapped I/O operations to write data and set direction bits.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_13.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 6: Conceptual diagram of an AXI Lite register transaction from software to a PL peripheral*

### 5.2. Why SmartConnect exists

The Programmable Logic design contains more than one AXI slave peripheral. There is an AXI GPIO block for the output register and an AXI GPIO block for the input register. The PS master port must be able to reach both. SmartConnect is the interconnect component that makes this clean. It provides address decoding and routing so that a single AXI master in the PS can access multiple AXI slave peripherals in the PL without manually constructing custom interconnect logic. In other words, SmartConnect acts as the switch fabric that connects the PS address space to multiple mapped peripherals.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_14.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 7: Vivado block design screenshot emphasizing PS AXI master to SmartConnect to two AXI GPIO slaves*

### 5.3. Clocks and resets for reliable PS to PL access

Memory mapped PL peripherals only respond correctly when the fabric clock domain is running and the AXI reset signals have been deasserted. This project intentionally uses a single fabric clock domain driven by the PS generated fabric clock at 50 MHz. That clock drives the AXI interconnect and both AXI GPIO peripherals. Reset is generated using the standard processor system reset block, which takes a PS provided reset input and produces synchronized active low reset outputs for the interconnect and peripherals. This separation matters because interconnect logic and endpoint peripherals can have different reset timing requirements, and a standard reset block ensures a clean deassertion sequence.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_15.png)
{: .img-fluid .rounded .z-depth-1 }

## The PL datapath: AXI GPIO out to inverter to AXI GPIO in

The Programmable Logic portion of this design is a sanity datapath intended to be deterministic and easy to validate. Two AXI GPIO blocks expose registers to the Processing System. The output GPIO block presents a 32 bit value as a fabric signal. That signal is then passed through a vector logic block configured as a bitwise inversion. The inverted bus drives the input of the second GPIO block, allowing the PS to read the inverted value back through a different address.

This design choice has two practical benefits. First, it isolates connectivity and address mapping issues. If the PS can write a word and read a different transformed word, then the AXI path, clocks, resets, address map, and peripheral configuration are all correct. Second, it provides a predictable transform. Inversion is both simple and high contrast. Any single bit error is visible, and common test patterns make failures immediately obvious.

### 6.1. The register interface exposed by AXI GPIO

AXI GPIO peripherals present a small set of registers. Two of the most important are the data register and the tri state direction register. The direction register controls whether each bit is treated as an input or an output. For the output GPIO block, the software configures the direction so that all bits are outputs. For the input GPIO block, the software configures the direction so that all bits are inputs. Once directions are configured, writing the data register updates the output bus, and reading the data register returns the sampled input bus. This is the mechanism by which the PS effectively controls and observes PL signals using memory mapped I/O. Vivado assigns each AXI GPIO a base address in the system map; in this design the IN block is at 0x4120\_0000 and the OUT block is at 0x4121\_0000 (Figure 8). Within each GPIO, software accesses registers by base + offset, where DATA = 0x0 and TRI = 0x4 (Figure 9).

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_16.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 8: Vivado Address Editor showing AXI GPIO base addresses (IN @ 0x4120\_0000, OUT @ 0x4121\_0000)*

| **Register** | **Offset** | **Access** | **Meaning** |
| --- | --- | --- | --- |
| **DATA** | 0x0 | R/W | Read input bus or drive output bus |
| **TRI** | 0x4 | R/W | Direction bits (0 = output, 1 = input) |

*Table 1: AXI GPIO register offsets used in software (DATA=0x0, TRI=0x4).*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_17.png)
{: .img-fluid .rounded .z-depth-1 }

## End to end network validation strategy

A bring up strategy benefits from having both a general sanity check and an application specific test. This project uses two complementary tests that serve different purposes.

The first test is a standard lwIP TCP echo server example. It listens on a TCP port and echoes back whatever bytes arrive. Because TCP is connection oriented and stream based, this test is particularly convenient for interactive validation using common tools. If a host can connect, send characters, and see them echoed back, then the network link, IP configuration, and the lwIP processing loop are working end to end. This test is intentionally independent of the Programmable Logic, so it isolates Ethernet and lwIP.

The second test is the project’s custom lwIP UDP inverter application. This test is not interactive text. It defines a small binary protocol. The host sends exactly four bytes representing a 32 bit word in little endian byte order. The board writes that word into the output GPIO register, reads the inverted value from the input GPIO register, and replies with eight bytes containing the original word followed by the readback word. If the host receives a response and the second word equals the bitwise inversion of the first, then PS to PL register access is verified alongside networking.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_18.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 9: Testing architecture diagram showing the TCP echo test and the UDP inverter test and what each validates*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_19.png)
{: .img-fluid .rounded .z-depth-1 }

## TCP and UDP in this project: why both exist and what each proves

TCP and UDP are often compared in abstract terms, but this project illustrates the difference through concrete implementations.

TCP, as used in the echo server example, is connection oriented. The server binds to a port, transitions into a listening state, and accepts client connections. Once a connection exists, data is exchanged as a byte stream. There is no inherent message boundary in TCP. If a client sends ten bytes, the server might receive them as one chunk or multiple chunks depending on buffering, timing, and flow control. The echo example simply writes back whatever bytes were received. This makes TCP echo an excellent bring up test because it does not require a custom application framing protocol. Any payload, including plain text, can be used immediately.

UDP, as used in the inverter application, is connectionless. The server binds to a port and receives discrete datagrams. Each datagram preserves message boundaries, which makes UDP convenient for fixed size command response exchanges. In this design, the datagram boundary is treated as the application message boundary. The server expects exactly four bytes and rejects anything else. When the correct payload length is received, the server executes a single deterministic transaction against the PL registers and returns a single deterministic response. This is a better fit than TCP for a register style command protocol because the message is naturally framed and the overhead is lower.

The two tests therefore serve different purposes. The TCP echo server demonstrates that Ethernet and lwIP are operational in a way that is easy to reproduce with generic tools and arbitrary payloads. The UDP inverter demonstrates that networking and PS to PL register access are working together in a deterministic, verifiable control loop.

*![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_20.png)*

*Figure 10: Protocol comparison diagram showing TCP as a stream and UDP as message framed datagrams*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_21.png)
{: .img-fluid .rounded .z-depth-1 }

## Simulation‑Only Validation of the AXI GPIO Loopback

To validate the PL inverter without hardware, I built a simulation‑only block design. The AXI VIP acts as a stand‑in for the PS, issuing AXI‑Lite reads and writes. Those transactions pass through SmartConnect and reach two AXI GPIO blocks—one configured as output and one as input—with a 32‑bit NOT between them. I exported the clock and reset as external ports (clk\_in1\_0, ext\_reset\_in\_0) so the testbench could drive them directly. The proc\_sys\_reset and clocking wizard provide a realistic reset/clock environment, while the VIP gives full control of addresses and data from the testbench. This makes the simulation faithful to real AXI behavior but still simple and self‑contained for regression testing. It should be noted that I configured the Clocking Wizard IP block reset to be active low as it is set to active high by default.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_22.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 11: Simulation‑only block design for AXI‑Lite verification (AXI VIP → SmartConnect → AXI GPIO IN/OUT with inverter)*

A 100 MHz clock is generated in the testbench (always #5 clk\_in1 = ~clk\_in1;), and reset is asserted low for several cycles before being released. Once reset deasserts, the AXI VIP master issues a sequence of AXI‑Lite writes to the GPIO OUT base address (0x4121\_0000) and immediately reads back from the GPIO IN base address (0x4120\_0000). Each read is checked against the expected inverted value using a small pass/fail scoreboard inside the do\_one() task. Test vectors cover a mix of corner cases and patterns as seen in the table below.

| **Write (W)** | **Expected Read (R = ~W)** |
| --- | --- |
| 0x00000000 | 0xFFFFFFFF |
| 0xFFFFFFFF | 0x00000000 |
| 0x12345678 | 0xEDCBA987 |
| 0xA5A5A5A5 | 0x5A5A5A5A |

*Table 2: AXI GPIO inverter test vectors and expected readback*

On a successful run, the TCL console shows PASS messages for each vector followed by $finish, confirming that the AXI GPIO write/read path and the PL inverter are both functioning as seen in the figure below.

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_23.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 12: XSim TCL console showing AXI‑VIP PASS messages and end‑of‑simulation checks*

*Figure 13 highlights the key AXI-Lite signals from the VIP master. clk\_in1 is the 100MHz testbench clock; ext\_reset is the active-low reset driven by the testbench; aclk is the AXI clock inside the BD (from the clocking wizard). m\_axi\_wdata[31:0] is the data written to GPIO OUT, m\_axi\_araddr[31:0] is the read address for GPIO IN, and m\_axi\_rdata[31:0] is the returned read data. resp[1:0] shows the AXI response code for each transaction, and rdata[31:0] is the testbench’s captured readback used in the comparison check.*

![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_24.png)
{: .img-fluid .rounded .z-depth-1 }

*Figure 13: Behavioral simulation waveform showing AXI‑Lite writes to GPIO OUT and reads from GPIO IN returning the inverted data.*![](/assets/img/posts/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/image_25.png)

## Summary and transition to implementation details

This system overview established the key architectural decisions behind the project. Ethernet is implemented using GEM0 over MIO because the ZC702 board routes the onboard PHY to the Processing System’s dedicated Ethernet interface. The Programmable Logic exists to provide a minimal, deterministic datapath that can be exercised through memory mapped AXI Lite register accesses. The PS reaches the PL through the AXI general purpose port and an AXI interconnect, and two AXI GPIO peripherals expose a simple register interface for write and readback. Finally, validation is performed in two layers: a generic TCP echo server test to confirm the network stack, and a custom UDP inverter protocol to confirm the combined networking and PS to PL control path.

The next post will focus on the hardware construction in Vivado. It will walk through the Processing System configuration for GEM0, the block design composition, address mapping, clock and reset wiring, bitstream generation, and XSA export for Vitis.
