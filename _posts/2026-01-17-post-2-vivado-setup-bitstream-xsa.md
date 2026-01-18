---
layout: post
title: "Post 2: Vivado setup, bitstream, and hardware export (XSA)"
date: 2026-01-17
description: "This post documents the Vivado hardware build for the ZC702 Ethernet bring up project. The design has two goals."
tags: [zynq, zc702, ethernet, lwip, axi, vivado, vitis, ps-pl]
---

![The image shows a very long, narrow horizontal strip of uniform white/light-gray color across the frame with no discernible objects, text, or features.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_001.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

**Author(s):** Mostafa Elsanousi, [Muhammad Farhan Azmine](https://github.com/muhammadfarhan720)

**Publication Date:** 2026-01-17

**Target Board:** AMD/Xilinx ZC702 (xc7z020 Zynq-7000)<br>**Toolchain:** Vivado 2025.1, Vitis 2025.1<br>**Keywords:** Zynq, GEM0, Ethernet, MIO, RGMII, lwIP, UDP, AXI, AXI4-Lite, SmartConnect, GPIO

## Code and Resources

All project materials for this Ethernet bring-up are in my repository: [ZC702 Ethernet Bring-up Repository](https://github.com/Elsanousi2005/zc702-ps-ethernet-udp-gpio-inverter).

It includes the Vivado project (.xpr), the block design, exported hardware (.xsa/.hwh), the Vitis bare-metal sources for both the TCP echo example and the UDP inverter application, plus the host-side Python script used to send UDP test vectors.

You can open the hardware project directly in Vivado (File -> Open Project -> select the .xpr).

![The image is mostly blank white with a thin dark gray/black horizontal bar running across the very top edge. No other objects, text, or details are visible - it looks like a cropped header or an empty page/screenshot.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_002.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 1. Introduction

This post documents the Vivado hardware build for the ZC702 Ethernet bring up project. The design has two goals. First, it enables the Zynq PS Ethernet controller GEM0 and routes it through MIO to the onboard PHY and RJ45 connector. Second, it implements a minimal PL datapath that the PS can access through AXI memory mapped registers, using AXI GPIO OUT, an inverter, and AXI GPIO IN. The output of this post is a generated bitstream and a matching XSA for Vitis.

![A Vivado block-design diagram for a Zynq-7000 system showing a small AXI-based hardware graph: - Core blocks: - processing_system_7_0 (ZYNQ7 processing system) with M_AXI_GP0 interface, DDR and FIXED_IO pins. - rst_ps7_0_50M (Processor System Reset) providing reset/clock-related reset signals. - axi_interconnect_0 (AXI Interconnect) tying the PS M_AXI_GP0 master to AXI slaves. - Two AXI GPIO peripherals: axi_gpio_in and axi_gpio_out. - util_vector_logic_0 (vector logic, marked Discontinued) between the GPIO blocks. - Connections: - M_AXI_GP0 from the Zynq PS connects into the AXI Interconnect which fans out S_AXI to the two AXI GPIO blocks. - Reset/clock/reset-assert signals flow from rst_ps7_0_50M into the interconnect and GPIO blocks. - The gpio_io31:0 port from axi_gpio_in feeds the util_vector_logic_0 Op131:0; the logic output Res31:0 connects to gpio_io31:0 of axi_gpio_out. - DDR and FIXED_IO are routed out from the processing system block. Overall the diagram depicts a PS-driven AXI bus controlling an input GPIO, applying vector logic, and driving an output GPIO, with reset and clock management.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_003.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 1: Final system overview, PS Ethernet plus PS<->PL AXI GPIO loopback_

![Diagram of a UDP-based control path between a Host PC and an FPGA SoC split into Processing System (PS) and Programmable Logic (PL): - Left: Host PC running a UDP client. - Sends a 4-byte UDP datagram to the PS. - Receives an 8-byte UDP reply (sequence labeled "W then R"). - Middle: Processing System block - PS App: an lwIP UDP server. - GEM0 MAC and lwIP handle Ethernet/UDP. - M_AXI_GP0 (AXI4-Lite master) used by the PS app to access PL registers. - Right: Programmable Logic block - AXI GPIO OUT (registers written by PS). - A 32-bit NOT logic block that inverts the 32-bit GPIO lines. - AXI GPIO IN (registers read by PS), connected from the NOT output. - Data flow summary: - Host -> PS (4-byte UDP) -> PS writes via AXI4-Lite to AXI GPIO OUT. - PL performs bitwise NOT and updates AXI GPIO IN. - PS reads AXI GPIO IN and sends an 8-byte UDP reply back to Host.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_004.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }


![A wide, very thin rectangular image that is almost entirely white and featureless - no visible objects, text, or distinct markings.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_005.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 2: Overall PS-PL loop for the UDP inverter: host datagram -> lwIP -> AXI-Lite write -> PL invert -> AXI-Lite read -> UDP reply_

## 2. Project creation and block design setup

Create a new Vivado project targeting the ZC702 board (or the xc7z020 device if board files are not installed). Then create a block design, for example design\_1.

At this stage, the only required external interfaces are the PS MIO pins for Ethernet and the standard programming and UART interfaces used for bring up. The PL portion of this design is fully internal and does not require custom XDC constraints for external PL pins.

![- Screenshot of the Vivado ML Edition (Vivado 2025.2) application showing the "New Project" wizard. - Dialog titled "Default Part" with the "Boards" tab active; a list of evaluation boards is displayed (e.g., Spartan-7 SP701, Zynq 7000 ZC702, Zynq UltraScale+ ZCU104). - The Zynq 7000 ZC702 Evaluation Board row is highlighted; columns show preview images, status ("Installed"), vendor (xilinx.com), file version, part number, I/O pin count, and board revision. - Controls visible: vendor/name filters, search box, Refresh button, and toolbar icons above the list. - Bottom of the dialog shows navigation buttons: Back, Next (enabled), Finish (disabled), Cancel. - Background of the IDE shows left sidebar panels: Quick Start, Tasks, and Learning Center; application titlebar at top-left displays AMD Vivado ML Edition.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_006.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![The image is a very wide, thin horizontal strip that is almost entirely blank/white, with a faint, thin horizontal gray line running near the top and no other discernible objects or details.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_007.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 3: Vivado project configuration showing ZC702 or xc7z020 selection_

## 3. Processing System configuration for GEM0 Ethernet on MIO

Add the Zynq7 Processing System IP block (processing\_system7\_0) and open the PS configuration GUI. Vivado will typically prompt you to Run Block Automation. Accept this prompt so Vivado applies the board preset, creates the required DDR and FIXED\_IO external interfaces, and enables the standard PS clocks and connections needed for a valid design. The configuration that matters for this project is confirmed by the generated hardware handoff file.

### 3.1. Enable ENET0 and route it on MIO

In this design, Ethernet 0 (GEM0) is enabled and routed through MIO 16 through 27 to reach the onboard PHY using the RGMII signal group. MDIO is also enabled on MIO 52 and 53 so the PS can manage the PHY, including reading link status and completing auto negotiation. For readability, the mapping is presented through the PS configuration screenshots rather than listing every signal name.

![The screenshot shows Xilinx Vivado 2025.2 with a block-design editing session open. Key elements visible: - Main window title: "zynq-axi-eth-final - C:/Users/.../zynq-axi-eth-final/zynq-axi-eth-final.xpr - Vivado 2025.2". - Left Flow Navigator with sections: Project Manager, IP Integrator (highlighted), Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug. - Center area: "BLOCK DESIGN" tab with a modal dialog titled "Re-customize IP - ZYNQ7 Processing System (5.5)". - Dialog shows the MIO Configuration page: a tree listing I/O Peripherals with "ENET 0" expanded and "MDIO" selected. - A table of MIO assignments (columns: Peripheral, IO, Signal, IO Type, Speed, Pullup, Direction) mapping Ethernet signals to MIO pins (e.g., Enet0 MIO16..MIO27, MIO16..21 entries) and IO Type set to HSTL 1.8V. - Bottom of dialog has OK and Cancel buttons. - Background shows the block design canvas and toolbar; top-right status shows "write_bitstream Complete" with a green check.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_008.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


### 3.2. PHY reset control

In this exported configuration, ENET reset control is not enabled from the PS configuration. In other words, the PS is not driving a dedicated ENET reset MIO pin in this design. The PHY reset behavior therefore relies on the board level reset circuitry and PHY strap configuration.

![The image is almost entirely blank white with a very thin, faint horizontal gray line across the middle; no other objects, text, or distinct features are visible.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_009.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 4: PS7 configuration showing ENET0 enabled and mapped to MIO 16-27 and MDIO enabled and mapped to MIO 52 and 53_

## 4. PS to PL clocking and AXI master port

The PL peripherals are accessed by the ARM cores through a PS to PL AXI general purpose master port.

### 4.1. Fabric clock

This design uses a single PL clock domain driven by FCLK\_CLK0, configured for 50 MHz. In the handoff, the clock is generated from the IO PLL with divisors that result in 50 MHz.

This clock drives:

- The PS M AXI GP0 interface clock
- The AXI SmartConnect clock
- Both AXI GPIO clocks

![Screenshot of the Xilinx Vivado IDE showing an open Block Design and a modal dialog titled "Re-customize IP - ZYNQ7 Processing System (5.5)". The dialog is on the Clock Configuration page (Basic Clocking tab). In the table the PL Fabric Clocks section shows FCLK_CLK0 checked and highlighted (yellow) with Clock Source "IO PLL", Requested Frequency "50", Actual Frequency "50.000000", and Range "0.100000 : 250.000000". The IDE left Flow Navigator lists project steps (Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug). The block design canvas and an AXI slave block are visible at right; bottom panes show Tcl Console, Messages, Log, Reports, and Design Runs. The Vivado window title and toolbar are visible across the top.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_010.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


### 4.2. Enable M\_AXI\_GP0

The PS exports M\_AXI\_GP0 for memory mapped access into the PL. In the handoff, this port is configured for a 50 MHz domain and provides the master interface used to reach both AXI GPIO blocks through SmartConnect.

![- Screenshot of Xilinx Vivado (Vivado 2025.2) showing the IP Integrator Block Design workspace. - A modal titled "Re-customize IP - ZYNQ7 Processing System (5.5)" is open, with the "PS-PL Configuration" tab selected. - In the modal the "General" section is expanded and "AXI Non Secure Enablement" options are shown; the "M AXI GP0 interface" (labelled "GP Master AXI Interface / M AXI GP0 interface") appears checked while "M AXI GP1 interface" is not. - Left pane shows the Flow Navigator (Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug). - Background shows the block design canvas with a PS block and an AXI SmartConnect (S00_AXI, S01_AXI) and the Vivado status bar and console tabs at the bottom.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_011.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 5: PS7 clock configuration showing FCLK0 enabled at 50 MHz_


![The image is a very narrow, wide horizontal strip that's almost entirely white/very light gray, with no distinct objects or features visible - essentially a blank, high-aspect-ratio white bar.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_012.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 6: PS7 configuration showing M\_AXI\_GP0 enabled_

## 5. PL datapath: SmartConnect, AXI GPIO, and inverter logic

Add the following IP blocks:

- AXI SmartConnect
- AXI GPIO, configured as 32 bit output
- AXI GPIO, configured as 32 bit input
- Inline Utility Vector Logic, configured as bitwise NOT for a 32 bit vector

### 5.1. SmartConnect routing

SmartConnect connects the PS master M\_AXI\_GP0 to multiple AXI Lite slave peripherals. In this design, it fans out from the PS master to the two AXI GPIO blocks. Ensure that the SmartConnect is configured to have two slave interfaces and one master interface.

![Screenshot of Xilinx Vivado's IP Integrator showing a "Re-customize IP" dialog for "AXI SmartConnect (1.0)". Main elements: - Dialog title bar: "AXI SmartConnect (1.0)" with tabs for Documentation and IP Location. - Center/right pane: "Component Name smartconnect_0" and Standard Properties section (highlighted) showing: - Number of Slave Interfaces: 1 - Number of Master Interfaces: 2 - Number of Clock Inputs and Has ARESETN Input fields - Left pane: small block diagram of the AXI SmartConnect node labeled S00_AXI with ports aclk, aresetn and outputs M00_AXI, M01_AXI. - Bottom of dialog: "OK" and "Cancel" buttons. - Background: Vivado IDE workspace with Flow Navigator on the left (Project Manager, IP Integrator, Synthesis, Implementation, etc.), a block design on the right with GPIO blocks, and bottom panes (Tcl Console, Messages, Log, Reports). Title bar shows project path and Vivado 2025.2.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_013.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![- Screenshot of Xilinx Vivado (version 2025.2) showing the IP Integrator Block Design view. - Left pane: Flow Navigator with sections (Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug). - Central area: Block Design canvas (design_2) with a Zynq-7000 Processing System block labeled processing_system7_0. - processing_system7_0 connects to DDR and FIXED_IO on the right, and its M_AXI_GP0 master goes into an AXI SmartConnect (smartconnect_0). - smartconnect_0 fans out to two AXI GPIO peripherals (axi_gpio_out and axi_gpio_in); AXI signals (S_AXI, aclk, aresetn) are visible. - A green banner at top of canvas reads "Designer Assistance available. Run Connection Automation." - Top toolbar, tabs (Diagram, Address Editor, Address Map) and bottom panes (Tcl Console, Messages, Log, Reports, Design Runs) are visible; status at upper-right shows "write_bitstream Complete."](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_014.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 7: AXI SmartConnect configuration page_


### 5.2. AXI GPIO configuration

The AXI GPIO blocks, instantiated as axi\_gpio\_out and axi\_gpio\_in in the block design, are configured as single channel 32 bit peripherals:

- axi\_gpio\_out is all outputs, width 32
- axi\_gpio\_in is all inputs, width 32

![Screenshot of Xilinx Vivado's IP Integrator interface showing the "Re-customize IP" dialog for "AXI GPIO (2.0)". The dialog's "IP Configuration" tab is selected and highlights GPIO settings: "All Outputs" checked, GPIO Width = 32, Default Output Value = 0x00000000, Default Tri State Value = 0xFFFFFFFF. "Enable Dual Channel" is unchecked and the second GPIO channel fields are disabled. In the background is the block design with an S_AXI GPIO block and connections to DDR and FIXED_IO; the Flow Navigator and project panes are visible at the left. The dialog has "OK" and "Cancel" buttons at the bottom.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_015.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 8: Block design showing M\_AXI\_GP0 connected through SmartConnect to two AXI GPIO peripherals_


![Image of the Xilinx Vivado IP Integrator GUI showing the "Re-customize IP" dialog for "AXI GPIO (2.0)". Key visible items: - Dialog title "Re-customize IP" and component name "axi_gpio_in". - Two tabs: "Board" and "IP Configuration" (IP Configuration active). - GPIO configuration panel: "All Inputs" checked, "GPIO Width" = 32, "Default Output Value" = 0x00000000, "Default Tri State Value" = 0xFFFFFFFF. Option to "Enable Dual Channel" and "Enable Interrupt" present but not enabled. - Left side shows block diagram with an AXI GPIO block labeled with ports (S_AXI, s_axi_aclk, s_axi_aresetn). - Background Vivado IDE elements: Flow Navigator on the left (PROJECT MANAGER, IP INTEGRATOR, etc.), top menu and window title indicating Vivado 2025.2, and status "write_bitstream Complete" in the top-right. Buttons "OK" and "Cancel" at bottom of the dialog.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_016.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 9: AXI GPIO OUT configuration page_
Figure 10: AXI GPIO IN configuration page*

### 5.3. Inverter logic

The PL transform is intentionally simple. The output bus from axi\_gpio\_out is inverted and wired into the input bus of axi\_gpio\_in. In the synthesized netlist, this becomes a direct inversion assignment, which is ideal for a sanity datapath.

![A screenshot of Xilinx Vivado (Vivado 2025.2) showing an IP Integrator block design and an open IP customization dialog. - Main window: Vivado project titled "zynq-axi-eth-final" (full path shown in the title bar). - Left pane: Flow Navigator with sections like Project Manager, IP Integrator, RTL Analysis, Synthesis, Implementation, Program and Debug. - Center: Block Design canvas (tabs: design_1, design_2) with a ZYNQ Processing System block and an orange Inline Utility Vector Logic block named ilvector_logic_0 connected by nets to the processing system and I/O (DDR, FIXED_IO). - Foreground: "Re-customize IP" dialog for "Inline Utility Vector Logic (1.0)": - Shows component name (ilvector_logic_0). - Parameter C_SIZE set to 32. - C_OPERATION radio options: and, or, xor, not (one selected). - Left side shows the block symbol with ports Op31:0 and Res31:0. - Status: top-right indicates "write_bitstream Complete" with a green check.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_017.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![A screenshot of Xilinx Vivado (Vivado 2025.2) showing the IP Integrator block design canvas. The main diagram displays a Zynq7 processing_system7_0 on the left, an AXI SmartConnect in the center, and a yellow-highlighted region on the right containing two AXI GPIO IP blocks (axi_gpio_out, axi_gpio_in) and an Inline Utility Vector Logic block (ilvector_logic_0) wired between them. The Zynq block is connected to DDR and FIXED_IO pins at the top and to the SmartConnect via M_AXI_GP0. The toolbar and tabs (Diagram, Address Editor, Address Map) appear above the canvas, and the Flow Navigator (Project Manager, IP Integrator, RTL Analysis, Synthesis, Implementation, Program and Debug) is visible in the left pane. The window title shows the project path (zynq-axi-eth-final) and a "write_bitstream Complete" status in the title bar.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_018.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 11: Inline Utility Vector Logic configuration page_


![A very long, narrow, mostly blank white strip with faint gray/black horizontal edges - appears to contain no distinct objects or details.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_019.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 12: Inline Utility Vector Logic wiring, emphasizing AXI GPIO OUT to AXI GPIO IN through a 32 bit inverter in the PL fabric_

## 6. PL bring up essentials: resets and address map

### 6.1. Reset wiring and why it matters

The Processor System Reset IP (proc\_sys\_reset\_0) provides a clean, clock synchronized reset strategy for the PL fabric clock domain. It takes an asynchronous reset source from the PS and generates reset signals that deassert safely with respect to the fabric clock. This matters because AXI peripherals and interconnect logic must not leave reset in an uncontrolled manner. If a peripheral is held in reset or an interconnect is not released properly, the PS can stall on the first AXI transaction.

In this design, all PL logic runs in a single clock domain driven by processing\_system7\_0.FCLK\_CLK0 at 50 MHz. The PS also provides a corresponding fabric reset signal, FCLK\_RESET0\_N, which is used as the external reset input to the reset controller. In other words, FCLK\_CLK0 clocks the entire AXI fabric, while proc\_sys\_reset deasserts resets in two stages: first the interconnect, then the peripherals. A typical and recommended wiring is:

- proc\_sys\_reset\_0.slowest\_sync\_clk is driven by FCLK\_CLK0
- proc\_sys\_reset\_0.ext\_reset\_in is driven by FCLK\_RESET0\_N

After adding proc\_sys\_reset\_0, Vivado Connection Automation can be used to connect these clock and reset inputs, and it will also correctly apply the shared clock to the AXI domain:

- axi\_gpio\_in.s\_axi\_aclk and axi\_gpio\_out.s\_axi\_aclk driven by FCLK\_CLK0
- processing\_system7\_0.M\_AXI\_GP0\_ACLK driven by FCLK\_CLK0

However, one reset connection must be verified and in this project it must be applied manually. The AXI interconnect must be released from reset in the correct way, and Connection Automation may not automatically connect the SmartConnect reset input. For a robust AXI reset scheme, the two reset outputs from proc\_sys\_reset\_0 are used as follows:

- proc\_sys\_reset\_0.interconnect\_aresetn must drive smartconnect\_0.aresetn
- proc\_sys\_reset\_0.peripheral\_aresetn must drive the AXI GPIO reset pins, axi\_gpio\_in.s\_axi\_aresetn and axi\_gpio\_out.s\_axi\_aresetn

This split is intentional. interconnect\_aresetn is intended for the AXI routing and handshake infrastructure, while peripheral\_aresetn is intended for AXI slave peripherals. Using the correct reset outputs ensures that the SmartConnect fabric becomes stable before peripherals begin responding, and it prevents early AXI transactions from being issued into a partially reset interconnect. With FCLK\_CLK0, FCLK\_RESET0\_N, and these two reset nets wired consistently, the PS to PL AXI path becomes deterministic and software can safely access the AXI GPIO registers at startup.

![- Screenshot of Xilinx Vivado (title shows Vivado 2025.2) with a Block Design open. - Modal dialog titled "Run Connection Automation" centered over the block design canvas. - Left side of the dialog shows an interface tree (highlighted in yellow) with "All Automation (5 out of 5 selected)" expanded to list: - axi_gpio_in (s_axi_aclk checked) - axi_gpio_out (s_axi_aclk checked) - proc_sys_reset_0 (ext_reset_in and slowest_sync_clk checked) - processing_system7_0 (M_AXI_GP0_ACLK checked) - Right side of the dialog is empty with the prompt "Select an interface pin on the left panel to view its options". - Dialog has OK and Cancel buttons at the bottom. - Underlying window shows the Block Design canvas with blocks (e.g., Vector Logic) and external ports (DDR, FIXED_IO) and the Vivado Flow Navigator on the left (Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug).](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_020.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![This is a screenshot of Xilinx Vivado (Vivado 2025.2) showing the IP Integrator Block Design canvas for a project named "zynq-axi-eth-final". Main visible elements: - Flow Navigator on the left (Project Manager, IP Integrator, Simulation, Synthesis, Implementation, Program and Debug). - Block Design tab with diagram view of a Zynq-based design: - processing_system7_0 (Zynq Processing System) with DDR and FIXED_IO pins. - proc_sys_reset_0 (Processor System Reset). - axi_smartconnect_0 (AXI SmartConnect). - Two AXI GPIO blocks (axi_gpio_out, axi_gpio_in). - ilvector_logic_0 (Inline Utility Vector Logic) connecting GPIO signals. - Colored interconnect wires showing AXI, clocks, resets, and peripheral connections. - Tabs across the top (Diagram, Address Editor, Address Map, design_1.v) and toolbar; status "write_bitstream Complete" in the upper-right.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_021.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 13: Expected Run Block Automation prompt_



<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr>
      <th style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><strong>\1</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #d0d0d0; padding: 8px; text-align: center;"><ul><li>Pink indicates the PL clock domain driven by FCLK\_CLK0.</li><li>Blue indicates the PS sourced fabric reset (FCLK\_RESET0\_N) into proc\_sys\_reset\_0.</li><li>Green indicates peripheral reset (peripheral\_aresetn) applied to the AXI GPIO blocks.</li><li>Brown indicates interconnect reset (interconnect\_aresetn) applied to the AXI SmartConnect.</li><li>Black indicates the purely fabric side loopback datapath implemented with ilvector\_logic\_0 (bitwise NOT).</li></ul></td>
    </tr>
  </tbody>
</table>


### 6.2. Address assignment for the PL peripherals

Address assignment defines the memory map that the PS uses to reach PL peripherals through AXI. Once exported to the XSA, these base addresses become the software contract via xparameters.h, so the Vivado address map and the Vitis platform must remain consistent.

Open the Address Editor and assign address ranges for both AXI GPIO blocks. The exported address map in this design is:

- axi\_gpio\_in: 0x4120\_0000 to 0x4120\_FFFF
- axi\_gpio\_out: 0x4121\_0000 to 0x4121\_FFFF

These addresses are later emitted into xparameters.h and used by the software through XPAR\_AXI\_GPIO\_IN\_BASEADDR and XPAR\_AXI\_GPIO\_OUT\_BASEADDR.

![A screenshot of Xilinx Vivado (Vivado 2025.2) showing the IP Integrator's Block Design view with the Address Editor open. Left pane contains the Flow Navigator (Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug). Center/top shows tabs for Block Design and Address Editor; the Address Editor lists Network 0 -> /processing_system7_0 -> /processing_system7_0/Data (32 address bits : 0x40000000 1G) with two S_AXI slave entries. A right-click context menu is open over the slave list with "Assign All" highlighted; other menu items include Properties, Unassign, Unassign All, Lock, View Address Path, Export/Import, Export to Spreadsheet. Bottom shows Vivado console tabs (Tcl Console, Messages, Log, Reports, Design Runs). Window title indicates project "zynq-axi-eth-final" and a green status "write_bitstream Complete" in the toolbar.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_022.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 14: Completed Vivado block design with clock sources and clock net routing highlighted_


![- Screenshot of Xilinx Vivado (title bar: "zynq-axi-eth-final - Vivado 2025.2") showing the IP Integrator block design workspace. - Main area is the Address Editor tab for a block design (design_2), listing Network 0 -> /processing_system7_0/Data and two AXI GPIO slave interfaces: - /axi_gpio_in/S_AXI - Interface S_AXI, Slave Segment "Reg", Master Base Address 0x4120_0000, Range 64, Master High Address 0x4120_FFFF - /axi_gpio_out/S_AXI - Interface S_AXI, Slave Segment "Reg", Master Base Address 0x4121_0000, Range 64, Master High Address 0x4121_FFFF - Left pane shows Flow Navigator with sections: Project Manager, IP Integrator, Simulation, RTL Analysis, Synthesis, Implementation, Program and Debug. - Tabs and panes visible: Diagram, Address Editor, Address Map, design_1.v; bottom shows Tcl Console, Messages, Log, Reports, Design Runs. - Window status indicates "write_bitstream Complete" in the toolbar.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_023.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 15: Assigning AXI GPIO base addresses in Vivado Address Editor (Assign All)_


![The image appears to be a wide, nearly uniform white rectangle with no discernible objects, text, or other visible features.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_024.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 16: Address Editor showing AXI GPIO base addresses_

## 7. Validate design, generate wrapper, and build outputs

Before generating the bitstream, run design validation by right-clicking anywhere on the BD and selecting "Validate Design". Resolve any warnings that indicate missing clocks, missing resets, or unconnected AXI interfaces and proceed with the following steps.

Then complete the standard build flow:

1. Generate output products for the block design. Ensure that "Synthesis Options" is set to "Global."
2. Create the HDL wrapper. After, right-click the generated HDL wrapper (.v) and select "Set as Top" and "Let Vivado manage wrapper and auto-update" when prompted. The hierarchy should refresh automatically afterwards.
3. Generate the bitstream (automatically runs Synthesis and Implementation runs) by selecting the option at the bottom of the Flow Navigator under the "Program and Debug" section. Options can be left at their default states. Press "OK" when prompted. Ensure that the process completes without any fatal errors. The implemented design will automatically open, which includes information about the final hardware state after placing and routing on the xc7z020 device.

![A screenshot of Xilinx Vivado (title shows a Vivado project window) focused on the IP Integrator block-design view. - Window title: project path and Vivado version (Vivado 2025.2 visible). - Left pane: Flow Navigator with sections (PROJECT MANAGER, IP INTEGRATOR, SIMULATION, RTL ANALYSIS, SYNTHESIS, IMPLEMENTATION, PROGRAM AND DEBUG). "Generate Bitstream" is highlighted in yellow. - Center pane: Sources tree showing design files (design_1_wrapper, design_1, design_2). A context menu is open on a source node; the menu items "Generate Output Products..." and "Reset Output Products..." are highlighted with a yellow box. - Right/main pane: Block design diagram for a Zynq-based system: Zynq processing system block (processing_system7_0), Processor System Reset block, AXI SmartConnect, and two AXI GPIO blocks with colored AXI/interconnect/reset signal lines connecting them. - Top area: Diagram/Address Editor/Address Map tabs and standard toolbar icons.](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_025.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![Image: image_026.png](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_026.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 17: Locations of (1) Generate Output Products, (2) Create HDL Wrapper, and (3) Generate Bitstream_


![Image: image_027](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_027.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 18: Block design validation results_


With implementation complete and the bitstream generated successfully, the remaining Vivado work is primarily "handoff" work. In the next section, you export the hardware platform (XSA, including the bitstream) so that the Vitis platform and software are guaranteed to match the exact implemented hardware design (address map, AXI wiring, clocks, and resets).

![Image: image_028](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_028.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }
_Figure 19: Implementation complete with bitstream generation_

## 8. Export hardware and produce the XSA

Export hardware to generate a platform handoff for Vitis. Ensure the export includes the bitstream so the hardware and software remain synchronized during programming and debug. A key rule for bring up work is to treat the bitstream and XSA as a matched pair generated from the same implementation result. If you build software against one XSA but program a different bitstream, PS to PL accesses can fail even when addresses in code appear correct.

To export the hardware handoff:

1. In Vivado, go to File -> Export -> Export Hardware.
2. On the first screen, click Next.
3. On the options screen, check "Include bitstream".
4. Leave "Include binary" unchecked unless you specifically want an additional binary artifact for a boot flow. If you are not building a boot image, it is fine to omit it.
5. Click Next.
6. Choose a name and location for the exported hardware file, or keep the default name. Make sure there are no naming conflicts with older exports.
7. Click Next, then click Finish.

At the end of this step, you will have an XSA that Vitis can use to create a platform. In the next section, the Vitis platform and application will be built against this exported hardware so that the PS Ethernet and the PS to PL AXI peripherals are addressed and initialized consistently.

![Image: image_029](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_029.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }


![Image: image_030](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_030.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure }
_Figure 20: Export hardware dialog showing hardware export settings_
Figure 21: Export Hardware options with Include bitstream enable*

![Image: image_031](/assets/img/posts/post-2-vivado-setup-bitstream-xsa/image_031.png)
{: .img-fluid .rounded .z-depth-1 .d-block .post-figure-wide-xl }

## 9. Closing

At the end of this Vivado flow, the ZC702 hardware platform is complete. GEM0 Ethernet is enabled through MIO to the onboard PHY, and a minimal PL datapath is accessible through AXI Lite registers at a stable address map. The next post covers Vitis platform creation, lwIP integration, and a host side test that verifies Ethernet connectivity and PS to PL register access using the UDP inverter protocol.
