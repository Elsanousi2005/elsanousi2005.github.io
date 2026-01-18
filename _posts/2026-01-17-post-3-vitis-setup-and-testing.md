---
layout: post
title: "Post 3: Vitis Setup and Testing for PS Ethernet and PS to PL Validation"
date: 2026-01-17
description: "This post covers the Vitis side of the ZC702 bring up. The goal is to validate Ethernet in two layers so that failures are diagnosable rather than ambiguous."
tags: [zynq, zc702, ethernet, lwip, axi, vivado, vitis, ps-pl]
---

![Image: image_001.png](/assets/img/posts/post-3-vitis-setup-and-testing/image_001.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

**Author(s):** Mostafa Elsanousi, [Muhammad Farhan Azmine](https://github.com/muhammadfarhan720)

**Publication Date:** 2026-01-17

**Target Board:** AMD/Xilinx ZC702 (xc7z020 Zynq-7000)<br>**Toolchain:** Vivado 2025.1, Vitis 2025.1<br>**Keywords:** Zynq, GEM0, Ethernet, MIO, RGMII, lwIP, UDP, AXI, AXI4-Lite, SmartConnect, GPIO

## Code and Resources

All project materials for this Ethernet bring-up are in my repository: [ZC702 Ethernet Bring-up Repository](https://github.com/Elsanousi2005/zc702-ps-ethernet-udp-gpio-inverter).

It includes the Vivado project (.xpr), the block design, exported hardware (.xsa/.hwh), the Vitis bare-metal sources for both the TCP echo example and the UDP inverter application, plus the host-side Python script used to send UDP test vectors.

You can open the hardware project directly in Vivado (File -> Open Project -> select the .xpr).

![Image: image_002](/assets/img/posts/post-3-vitis-setup-and-testing/image_002.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 1. Purpose and validation strategy

This post covers the Vitis side of the ZC702 bring up. The goal is to validate Ethernet in two layers so that failures are diagnosable rather than ambiguous.

The first layer is a known good TCP echo server that exercises only the Processing System network path and lwIP. It provides a baseline that confirms link, IP configuration, and end to end TCP receive and transmit behavior without any dependency on Programmable Logic.

The second layer is the project's UDP inverter service. This validates Ethernet and lwIP UDP, and it also validates PS to PL memory mapped register access by writing to an AXI GPIO output register, passing through a PL inverter datapath, and reading back through an AXI GPIO input register. The application replies to the host with both the original word and the readback word so correctness can be verified in a single transaction.

A simple diagnostic rule of thumb is:

If TCP works but UDP fails, focus on PS to PL access, PL programming, address map mismatch, or UDP payload handling.
If both fail, focus on link, IP configuration, lwIP initialization, or host network setup.

![Image: image_003](/assets/img/posts/post-3-vitis-setup-and-testing/image_003.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

![Image: image_004](/assets/img/posts/post-3-vitis-setup-and-testing/image_004.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 2. Prerequisites and test setup

### 2.1. Required Artifacts

Before starting Vitis bring up, ensure you have:

1. A Vivado exported hardware handoff generated from the implemented design (.xsa).
2. The corresponding bitstream from the same Vivado build (.bit).
3. The Vitis application sources for the TCP echo server and the UDP inverter service.
4. A host side testing environment, ideally a Linux PC with netcat, hexdump, and Python 3 available.

A key bring up rule is to treat the XSA and the bitstream as a matched pair from the same implementation result. If you build software against one XSA but program a different bitstream, PS to PL register access can fail even when addresses in software appear correct.

### 2.2. Host NIC Static IPv4 Configuration

For a direct PC to board cable, the host Ethernet interface must be placed on the same IPv4 subnet as the ZC702. In this project, the board uses a static address of 192.168.1.10/24, so a typical host address is 192.168.1.20/24 with a 255.255.255.0 netmask. A gateway is optional for a direct link and can be left blank.

1. Open Settings on Ubuntu, then select Network in the left sidebar.
2. Under Wired, identify the Ethernet connection that is physically connected to the ZC702.
3. Click the gear icon next to that connection to open its configuration dialog.

![Image: image_005](/assets/img/posts/post-3-vitis-setup-and-testing/image_005.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

4. Go to the IPv4 tab.
5. Change IPv4 Method from Automatic (DHCP) to Manual.

![Image: image_006](/assets/img/posts/post-3-vitis-setup-and-testing/image_006.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

6. Add an IPv4 address for your host, for example:
- Address: 192.168.1.20
- Netmask: 255.255.255.0
- Gateway: (optional for direct link, you may leave it blank)
7. Click Apply, then toggle the Wired connection off and back on if the settings do not take effect immediately.

### 2.3. Board Hardware Setup and Link Indicators

Use the following physical setup before launching any application:

1. Power: Connect the ZC702 barrel jack supply, then set the board power switch to ON.
2. JTAG (program and run): Connect the USB JTAG cable from the ZC702 to the host PC. This is used by Vitis to program the FPGA and launch the ELF.
3. UART (console): Connect the USB UART cable from the ZC702 to the host PC and verify it enumerates as a serial device. This will be used for a 115200 8N1 console.
4. Ethernet (data path): Connect an RJ45 cable from the ZC702 Ethernet port to the host PC's Ethernet port (or NIC dongle).

After plugging in Ethernet and powering the board, check the RJ45 LEDs. A healthy setup typically shows:

- A steady link LED indicating the PHY has established link.
- A blinking activity LED once traffic occurs (for example, during ping, TCP connect, or UDP packets).
- If the LEDs stay completely off, treat it as a physical layer issue first: wrong port, bad cable, wrong host interface selected, or the host NIC is disabled.


![Image: image_007](/assets/img/posts/post-3-vitis-setup-and-testing/image_007.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 2: Board setup showing power, JTAG, UART, and Ethernet status LEDs_

## 3. Vitis platform setup from the exported XSA

This workspace uses two platform components, one associated with the TCP echo baseline and one associated with the UDP inverter application. Keeping the baseline and the custom application separated helps prevent BSP setting conflicts occurring during bring up.

### 3.1. Create a platform component from the exported XSA

In Vitis Unified IDE:

**1. Launch Vitis and select a workspace.**
![Image: image_008](/assets/img/posts/post-3-vitis-setup-and-testing/image_008.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

**2. Create a new Platform Component.**

![Image: image_009](/assets/img/posts/post-3-vitis-setup-and-testing/image_009.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

**3. Name your platform file and click "Next"**

![Image: image_010](/assets/img/posts/post-3-vitis-setup-and-testing/image_010.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

**4. Choose Hardware Design and browse to the exported XSA from Vivado.**

![Image: image_011](/assets/img/posts/post-3-vitis-setup-and-testing/image_011.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

**5. Select the ps7\_cortexa9\_0 target and choose a standalone domain.**

![Image: image_012](/assets/img/posts/post-3-vitis-setup-and-testing/image_012.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

**5. Finish the wizard and build the platform.**
![Image: image_013](/assets/img/posts/post-3-vitis-setup-and-testing/image_013.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

### 3.2. Platform and Board Support Package configuration for lwIP and DHCP

Before creating either application, configure the Vitis platform so lwIP is included and DHCP behavior is explicit. This avoids the common bring up failure mode where the application builds and runs, but never obtains an IP address because the network stack configuration is incomplete or waiting on DHCP.

#### **1. Enable lwIP (lwip220) in the platform**

A. Open the platform component in Vitis. In the Components view, select the platform and open its settings ({}vitis-comp.json).

![Image: image_014](/assets/img/posts/post-3-vitis-setup-and-testing/image_014.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

B. Ensure the lwip220 library is enabled under the standalone domain configuration under the Board Support Package (BSP) so lwIP is actually included in the BSP. Save the change and rebuild the platform so the generated BSP reflects the new library selection.

####

####

####

####

![Image: image_015](/assets/img/posts/post-3-vitis-setup-and-testing/image_015.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

#### **2. Make DHCP behavior explicit in BSP settings**

Next, open the BSP settings panel for the same platform. The lwIP DHCP toggles here control what gets generated into lwipopts.h, which ultimately determines whether lwIP will attempt to request a DHCP lease.

For a direct PC-to-board Ethernet connection with no router or DHCP server, DHCP must be disabled. Otherwise the network stack can wait indefinitely for a lease that never arrives.

In this project's platform configuration, set the following to false (if not already set to false by default):

- lwip220\_dhcp = false
- lwip220\_dhcp\_debug = false
- lwip220\_dhcp\_options = false
- lwip220\_lwip\_dhcp\_does\_acd\_check

With DHCP disabled at the platform level, applications can use deterministic static addressing when their code assigns it.

If you are connected to a router and want DHCP instead, enable DHCP in the platform by setting the configurations above to true. In that network protocol mode, the board will obtain a dynamic IP on each run and you should read the assigned address from the UART log.

![Image: image_016](/assets/img/posts/post-3-vitis-setup-and-testing/image_016.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

 It is worth confirming the console routing in Vitis before building. In the platform view, open vitis-comp.json and check standalone\_stdin and standalone\_stdout under the standalone OS settings. These should point to UART1, which is the MIO-mapped UART on the ZC702 used for serial logs. This makes sure all xil\_printf output shows up on the UART terminal.

![Image: image_017](/assets/img/posts/post-3-vitis-setup-and-testing/image_017.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

### 3.3. Why two separate platform components are recommended

This project uses two nearly identical platforms, one for the TCP echo baseline and one for the UDP inverter test. While it is possible to build both applications against a single platform, separating them is a conservative choice for bring-up work because lwIP and BSP settings are platform-scoped.

When multiple applications share one platform, changing a lwIP setting for one test silently changes the environment for the other. Separate platforms keep each test's BSP stable and reproducible, and they make debugging more straightforward when comparing a known good baseline against the full system validation resulting in cleaner and more modular code.

Port numbers and protocol behavior are application level details and are covered in the next section when the TCP echo and UDP inverter applications are created and run.

![Image: image_018](/assets/img/posts/post-3-vitis-setup-and-testing/image_018.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 4. Section A: Baseline validation using the lwIP TCP echo server

### 4.1. What the TCP echo server does

The TCP echo server listens on a TCP port and echoes back any bytes received from the host. This validates the PS Ethernet path end to end, including lwIP receive, TCP processing, and lwIP transmit. Because it does not touch PS to PL peripherals, it isolates network bring-up from PL issues.

![Image: image_019](/assets/img/posts/post-3-vitis-setup-and-testing/image_019.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

### 4.2. Build and setup steps in Vitis

## **1. Create a new Application Component from an example template**

In Vitis, select File -> then select New Example.

![Image: image_020](/assets/img/posts/post-3-vitis-setup-and-testing/image_020.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **2. Select the template** From the example list, choose lwIP Echo Server, then click Create Application Component from Template.

![Image: image_021](/assets/img/posts/post-3-vitis-setup-and-testing/image_021.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **3. Name the application and select the platform**

- Enter a non conflicting application name (for example lwip\_echo\_server\_baseline).
- When prompted, select the platform component intended for the lwIP echo server baseline test.
- The application domain will be generated automatically to match the platform domain.
- Click Finish.

![Image: image_022](/assets/img/posts/post-3-vitis-setup-and-testing/image_022.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **4. Edit 1: Choose the TCP listening port**

Open echo.c in the newly created lwIP Echo Server application. The Vitis lwIP echo server template defines the listening port on line 100 as:

- unsigned port = 7; (line 100)

For this project, set the port to 6001 instead (for example, unsigned port = 6001;). Port selection is an application choice. The key requirement is simply that the server port in echo.c matches the port you use in host testing and, ideally, any corresponding UART banner text you include in your write up.

In this tutorial, the baseline TCP validation is performed on port 6001, so all TCP testing commands in this section will target 6001.

![Image: image_023](/assets/img/posts/post-3-vitis-setup-and-testing/image_023.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **5. Edit 2: Set a board specific MAC address (recommended best practice)**

Open main.c and locate the MAC address definition on line 128. The stock example uses a template MAC address value that often still works in a single board, direct PC to board setup, because there are no other devices competing with the same MAC on that isolated link.

Even though it is not strictly required for an isolated test, we still replace the template MAC with a board specific MAC address. This is the correct long term practice for repeatability and reuse. If you later connect the board to a network with other devices or a DHCP server, duplicate MAC addresses can cause subtle failures such as ARP confusion or DHCP lease collisions. Using a unique MAC avoids those hard to debug issues and makes the setup robust across different network environments.

![Image: image_024](/assets/img/posts/post-3-vitis-setup-and-testing/image_024.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **6. Build the application to generate the ELF.**

![Image: image_025](/assets/img/posts/post-3-vitis-setup-and-testing/image_025.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_026](/assets/img/posts/post-3-vitis-setup-and-testing/image_026.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

## **8.Open the UART Serial Monitor (115200 8N1) and verify startup messages**

In Vitis, open Vitis -> Serial Monitor and select the USB UART device for the board. In this project it appears as /dev/ttyUSB0 (Silicon Labs), which you can recognize by the manufacturer string. Set 115200 baud, 8 data bits, no parity, 1 stop bit (115200 8N1), then open the connection so the terminal is listening. After the terminal is open, run the application in Vitis. The server banner and status prints should then appear in the Serial Monitor output as the program executes.

![Image: image_027](/assets/img/posts/post-3-vitis-setup-and-testing/image_027.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_028](/assets/img/posts/post-3-vitis-setup-and-testing/image_028.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

### 4.3. Host side test on Linux

First confirm basic reachability using:

**ping 192.168.1.10**

Then open a TCP session to the echo server using:

**nc -v 192.168.1.10 6001**

Type a short line of text. You should see the same text echoed back by the board.

![Image: image_029](/assets/img/posts/post-3-vitis-setup-and-testing/image_029.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_030](/assets/img/posts/post-3-vitis-setup-and-testing/image_030.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_031](/assets/img/posts/post-3-vitis-setup-and-testing/image_031.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

### 4.4. What this test proves

A successful TCP echo session proves that:

1. The PHY link is up and the MAC is transmitting and receiving frames through GEM0.
2. The board IP configuration is correct for the local network.
3. lwIP is receiving traffic, processing TCP, and transmitting replies correctly.

![Image: image_032](/assets/img/posts/post-3-vitis-setup-and-testing/image_032.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 5. Section B: Full system validation using the UDP inverter application

### 5.1. What the UDP inverter service validates

The UDP inverter service is the full system test. It validates Ethernet and lwIP UDP, and it validates PS to PL memory mapped register access in a deterministic loop.

The host sends exactly 4 bytes representing a 32 bit word W in little endian order. The PS writes W to an AXI GPIO output register. In the PL, the output bus is bitwise inverted. The PS reads the inverted value R from an AXI GPIO input register and replies with 8 bytes containing W followed by R. The expected relationship is R equals bitwise NOT of W.

![Image: image_033](/assets/img/posts/post-3-vitis-setup-and-testing/image_033.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

### 5.2. UDP protocol definition

UDP port: 5005
Request payload: 4 bytes, little endian unsigned 32 bit word
Response payload: 8 bytes, concatenation of W and R, in the same byte ordering
Length check behavior: if the request is not exactly 4 bytes, the service replies with the ASCII string BADLEN


<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Request</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Host -> Board</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">4</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">W = 32-bit unsigned little-endian</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Single word command</td>
    </tr>
    <tr>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Response</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Board -> Host</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">8</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">W then R (both 32-bit, little-endian)</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">R = ~W</td>
    </tr>
    <tr>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Error</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Board -> Host</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">8</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">ASCII "BADLEN"</td>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;">Sent when request length != 4</td>
    </tr>
  </tbody>
</table>


This response format is intentional. Returning both W and R allows the host to validate correctness without maintaining additional state. The host can confirm that the second word equals the bitwise inversion of the first word for each transaction.

### 5.3. Build and run steps in Vitis

#### 1. Create a platform component for the UDP inverter (import the same XSA as in the TCP section) and ensure lwIP is enabled and the BSP DHCP choice is set as intended for your setup.
#### 2. Create an application component from your UDP inverter sources and select the UDP platform component.
#### 3. Build the application to generate the ELF.
#### 4. Open the Serial Monitor (115200 8N1), program the FPGA, and run the ELF on ps7\_cortexa9\_0.
#### 5. Confirm on UART that the banner prints and that the service reports it is listening on UDP port 5005.

![Image: image_034](/assets/img/posts/post-3-vitis-setup-and-testing/image_034.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

### 5.4. Host side UDP test (Python client)

Start with a ping to confirm reachability:

ping 192.168.1.10

Option A

Open a terminal on the host PC and run the client script from the repository. Expected readback is the bitwise inversion. For example, 0x12345678 becomes 0xEDCBA987.

cd ~/zc702-ps-ethernet-udp-gpio-inverter/host

python3 host\_udp\_inverter.py 192.168.1.10 0x12345678

Option B:

We can also test the UDP inverter using netcat with hexdump to see the raw bytes on the wire. This is an optional alternative to the Python client, but it is equally valid for confirming the protocol framing and end-to-end inversion:

echo -n -e '\x78\x56\x34\x12' | nc -u -w 3 192.168.1.10 5005 | hexdump -v -e '1/1 "%02x

Although the board replies essentially immediately, nc -u -w 3 keeps the socket open until the timeout expires, so hexdump does not print the bytes until netcat closes. By contrast, a TCP nc session stays interactive and shows echoed data as soon as it arrives, which is why the TCP test feels instant while the UDP one appears slightly delayed.

![Image: image_035](/assets/img/posts/post-3-vitis-setup-and-testing/image_035.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_036](/assets/img/posts/post-3-vitis-setup-and-testing/image_036.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }

![Image: image_037](/assets/img/posts/post-3-vitis-setup-and-testing/image_037.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

#### 6. Verification Summary

The TCP echo baseline verifies the PS side network stack end to end: GEM0 link, IP configuration, lwIP initialization, and TCP receive and transmit behavior, without involving the PL.

The UDP inverter test verifies the full system path: UDP reception, deterministic parsing, AXI Lite memory mapped writes and reads into the PL through AXI GPIO, and correct inversion on the PL datapath.

Together, these two tests separate network bring up from PS to PL integration, so failures are localized and the overall bring up process stays repeatable.
