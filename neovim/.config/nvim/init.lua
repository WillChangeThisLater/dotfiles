--[[

=====================================================================
==================== READ THIS BEFORE CONTINUING ====================
=====================================================================

Kickstart.nvim is *not* a distribution.

Kickstart.nvim is a template for your own configuration.
  The goal is that you can read every line of code, top-to-bottom, understand
  what your configuration is doing, and modify it to suit your needs.

  Once you've done that, you should start exploring, configuring and tinkering to
  explore Neovim!

  If you don't know anything about Lua, I recommend taking some time to read through
  a guide. One possible example:
  - https://learnxinyminutes.com/docs/lua/


  And then you can explore or search through `:help lua-guide`
  - https://neovim.io/doc/user/lua-guide.html


Kickstart Guide:

I have left several `:help X` comments throughout the init.lua
You should run that command and read that help section for more information.

In addition, I have some `NOTE:` items throughout the file.
These are for you, the reader to help understand what is happening. Feel free to delete
them once you know what you're doing, but they should serve as a guide for when you
are first encountering a few different constructs in your nvim config.

I hope you enjoy your Neovim journey,
- TJ

P.S. You can delete this when you're done too. It's your config now :)
--]]

-- Set <space> as the leader key
-- See `:help mapleader`
--  NOTE: Must happen before plugins are required (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

local function ensure_bin_on_path(bin_dir)
  if not bin_dir or bin_dir == '' then
    return
  end

  local normalized = vim.fn.fnamemodify(bin_dir, ':p')
  if normalized == '' or vim.loop.fs_stat(normalized) == nil then
    return
  end

  local path = vim.env.PATH or ''
  for segment in string.gmatch(path, '([^:]+)') do
    if segment == normalized then
      return
    end
  end

  vim.env.PATH = normalized .. (path == '' and '' or ':' .. path)
end

local function collect_nvm_bins()
  local nvm_versions = vim.fn.expand '$HOME/.nvm/versions/node'
  if nvm_versions == '' then
    return {}
  end

  local versions_pattern = nvm_versions .. '/*/bin'
  local node_versions = vim.fn.glob(versions_pattern, false, true)

  if vim.tbl_isempty(node_versions) then
    local fallback = vim.env.HOME and (vim.env.HOME .. '/.nvm/bin') or nil
    if fallback and vim.loop.fs_stat(fallback) then
      return { fallback }
    end
  end

  return node_versions
end

local candidates = {
  vim.fn.getenv 'NVM_BIN',
  vim.fn.expand '$HOME/.cargo/bin',
  vim.fn.expand '$HOME/go/bin',
  '/usr/local/go/bin',
  '/usr/bin',
}

for _, nvm_bin in ipairs(collect_nvm_bins()) do
  table.insert(candidates, nvm_bin)
end

for _, candidate in ipairs(candidates) do
  ensure_bin_on_path(candidate)
end

vim.opt.shortmess:append("I")
vim.opt.shortmess:append("c")

require('compat')

-- [[ Install `lazy.nvim` plugin manager ]]
require 'lazy-bootstrap'

-- [[ Configure plugins ]]
require 'lazy-plugins'

-- [[ Setting options ]]
require 'options'

-- [[ Basic Keymaps ]]
require 'keymaps'

-- [[ Configure Telescope ]]
-- (fuzzy finder)
require 'telescope-setup'

-- [[ Configure Treesitter ]]
-- (syntax parser for highlighting)
require 'treesitter-setup'

-- [[ Configure LSP ]]
-- (Language Server Protocol)
require 'lsp-setup'

-- [[ Configure nvim-cmp ]]
-- (completion)
require 'cmp-setup'

-- The line beneath this is called `modeline`. See `:help modeline`
-- vim: ts=2 sts=2 sw=2 et
--
-- chat setup
require("chat").setup({
  max_lines = 1000,
  llm_cmd   = { "llm" },        -- e.g., { "llm", "--model", "gpt5" }
  stream    = true,            -- set true if your `llm` streams
})

-- support .mdai
-- require('custom.markdown')
