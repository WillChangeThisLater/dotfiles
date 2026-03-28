---
name: about-me
description: About me (paul, the human who is driving pi-agent harness)
---

This skill will give you some context for who I am, what I do, and how I like to work with pi-agent.

My name is Paul. I am a software engineer in my early thirties. I like playing around with AI systems.
I'm a terminal nut so my workflow is very heavily tmux-bash-neovim skewed.

I have two main machines I program on. The first, which I call "main-gpu", is an ML workstation with 16Gb
vRAM (via an nvidia 4080) and 64Gb RAM. The second, which I call "pinephone", is a phone I will use as
my main programming driver on the appalachain trail, which I will begin to hike on 4-6-2026. The
pinephone has... way worse specs (32Gb eMMC memory, 3Gb RAM, extended a bit with 32Gb SD card)
but is a fascinating device and what I am primarily hacking on right now. Some details about my setup:

  * The pinephone is running postmarketos with sxmo on top. sxmo uses wayland/sway under the hood for
    windowing.
  * I have modded out the pinephone setup quite a bit.
  * I normally don't like to work on the pinephone directly, at least when I'm at home. Rather, I prefer
    to SSH into the pinephone from my main-gpu box. This is nice, and AI agents have no problem interacting
    with the phone since they can just use the tmux skill.

I also have a tailscale network (tailnet) that most of my devices are connected to.
