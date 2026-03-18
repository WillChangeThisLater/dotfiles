-- [[ Configure LSP ]]
--  This function gets run when an LSP connects to a particular buffer.
local on_attach = function(client, bufnr)
  -- NOTE: Remember that lua is a real programming language, and as such it is possible
  -- to define small helper and utility functions so you don't have to repeat yourself
  -- many times.
  --
  -- In this case, we create a function that lets us more easily define mappings specific
  -- for LSP related items. It sets the mode, buffer and description for us each time.
  local nmap = function(keys, func, desc)
    if desc then
      desc = 'LSP: ' .. desc
    end

    vim.keymap.set('n', keys, func, { buffer = bufnr, desc = desc })
  end

  local function has_capability(cap)
    local clients = vim.lsp.get_clients({ bufnr = bufnr })
    for _, active_client in ipairs(clients) do
      if active_client.server_capabilities[cap] then
        return true
      end
    end
    return false
  end

  nmap('<leader>rn', vim.lsp.buf.rename, '[R]e[n]ame')
  nmap('<leader>ca', function()
    vim.lsp.buf.code_action { context = { only = { 'quickfix', 'refactor', 'source' } } }
  end, '[C]ode [A]ction')

  nmap('gd', require('telescope.builtin').lsp_definitions, '[G]oto [D]efinition')
  nmap('gD', function()
    if has_capability('declarationProvider') then
      vim.lsp.buf.declaration()
    else
      vim.lsp.buf.definition()
    end
  end, '[G]oto [D]eclaration')
  nmap('gr', require('telescope.builtin').lsp_references, '[G]oto [R]eferences')
  nmap('gI', require('telescope.builtin').lsp_implementations, '[G]oto [I]mplementation')
  nmap('<leader>D', require('telescope.builtin').lsp_type_definitions, 'Type [D]efinition')
  nmap('<leader>ds', require('telescope.builtin').lsp_document_symbols, '[D]ocument [S]ymbols')
  nmap('<leader>ws', require('telescope.builtin').lsp_dynamic_workspace_symbols, '[W]orkspace [S]ymbols')

  -- See `:help K` for why this keymap
  nmap('K', vim.lsp.buf.hover, 'Hover Documentation')
  nmap('<C-k>', vim.lsp.buf.signature_help, 'Signature Documentation')

  -- Lesser used LSP functionality
  nmap('<leader>wa', vim.lsp.buf.add_workspace_folder, '[W]orkspace [A]dd Folder')
  nmap('<leader>wr', vim.lsp.buf.remove_workspace_folder, '[W]orkspace [R]emove Folder')
  nmap('<leader>wl', function()
    print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
  end, '[W]orkspace [L]ist Folders')

  -- Create a command `:Format` local to the LSP buffer
  vim.api.nvim_buf_create_user_command(bufnr, 'Format', function(_)
    vim.lsp.buf.format()
  end, { desc = 'Format current buffer with LSP' })

  -- Diagnostic navigation (using [d and ]d to avoid conflict with gd/gD)
  nmap('[d', vim.diagnostic.goto_prev, 'Prev Diagnostic')
  nmap(']d', vim.diagnostic.goto_next, 'Next Diagnostic')
  nmap('<leader>de', vim.diagnostic.open_float, 'Hover Diagnostics')
  nmap('<leader>dl', vim.diagnostic.setloclist, 'Open Location List')
end

-- document existing key chains using the new which-key spec
local wk = require('which-key')
wk.add({
  { '<leader>c', group = '[C]ode' },
  { '<leader>c_', hidden = true },
  { '<leader>d', group = '[D]ocument' },
  { '<leader>d_', hidden = true },
  { '<leader>g', group = '[G]it' },
  { '<leader>g_', hidden = true },
  { '<leader>h', group = 'Git [H]unk' },
  { '<leader>h_', hidden = true },
  { '<leader>r', group = '[R]ename' },
  { '<leader>r_', hidden = true },
  { '<leader>s', group = '[S]earch' },
  { '<leader>s_', hidden = true },
  { '<leader>t', group = '[T]oggle' },
  { '<leader>t_', hidden = true },
  { '<leader>w', group = '[W]orkspace' },
  { '<leader>w_', hidden = true },
}, { mode = 'n' })
wk.add({
  { '<leader>', group = 'VISUAL <leader>' },
}, { mode = 'v' })

-- mason-lspconfig requires that these setup functions are called in this order
-- before setting up the servers.
require('mason').setup()
require('mason-lspconfig').setup()

-- Enable the following language servers
--
--  Add any additional override configuration in the following tables. They will be passed to
--  the `settings` field of the server config. You must look up that documentation yourself.
--
--  If you want to override the default filetypes that your language server will attach to you can
--  define the property 'filetypes' to the map in question.
local servers = {
  bashls = {},
  cssls = {},
  dockerls = {},
  gopls = {},
  graphql = {},
  helm_ls = {},
  html = { filetypes = { 'html'} },
  --htmx = {}, -- install for this is not working for some reason
  jsonls = {},
  jqls = {},
  lua_ls = {
    Lua = {
      workspace = { checkThirdParty = false },
      telemetry = { enable = false },
      -- toggle below to ignore Lua_LS's noisy `missing-fields` warnings
      -- diagnostics = { disable = { 'missing-fields' } },
    },
  },
  marksman = {
    filetypes = { "markdown", "markdown.mdai" }, -- Add .mdai support
  },
  pyright = {},
  quick_lint_js = {},
  ts_ls = {
    settings = {
      completions = {
        completeFunctionCalls = true,
      },
      typescript = {
        preferences = {
          preferGoToSourceDefinition = true,
        },
        implementationsCodeLens = {
          enable = true,
        },
      },
      javascript = {
        preferences = {
          preferGoToSourceDefinition = true,
        },
        implementationsCodeLens = {
          enable = true,
        },
      },
    },
  },
  sqlls = {},
  tailwindcss = {},
}

-- Setup neovim lua configuration
require('neodev').setup()

-- nvim-cmp supports additional completion capabilities, so broadcast that to servers
local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities = require('cmp_nvim_lsp').default_capabilities(capabilities)

-- Ensure the servers above are installed
local mason_lspconfig = require 'mason-lspconfig'

mason_lspconfig.setup {
  ensure_installed = vim.tbl_keys(servers),
}

local lsp_config = vim.lsp.config

vim.lsp.config('*', {
  capabilities = capabilities,
  on_attach = on_attach,
})

for server_name, custom_settings in pairs(servers) do
  local server_opts = vim.tbl_deep_extend('force', {
    capabilities = capabilities,
    on_attach = on_attach,
  }, vim.deepcopy(custom_settings or {}))

  vim.lsp.config(server_name, server_opts)
end

vim.lsp.enable(vim.tbl_keys(servers))

-- Enable inline diagnostics (virtual text)
vim.diagnostic.config({
  virtual_text = true,      -- Show errors inline
  underline = true,         -- Underline problematic code
  update_in_insert = false, -- Don't update in insert mode (less distracting)
  severity_sort = true,     -- Sort by severity (errors first)
  signs = true,             -- Show signs in the signcolumn (your 'E' markers)
  float = {
    focusable = true,
    style = 'minimal',
    border = 'rounded',
    source = 'always',
    header = '',
    prefix = '',
  },
})

-- Linters
-- https://github.com/VonHeikemen/nvim-starter/blob/xx-mason/init.lua
-- local lspconfig = require('lspconfig')
-- local lsp_capabilities = require('cmp_nvim_lsp').default_capabilities()
--
-- require('mason-lspconfig').setup({
--   ensure_installed = {
--     'ts_ls',
--     'eslint',
--     'html',
--     'cssls'
--   },
--   handlers = {
--     function(server)
--       lspconfig[server].setup({
--         capabilities = lsp_capabilities,
--       })
--     end,
--     ['ts_ls'] = function()
--       lspconfig.ts_ls.setup({
--         capabilities = lsp_capabilities,
--         settings = {
--           completions = {
--             completeFunctionCalls = true
--           }
--         }
--       })
--     end
--   }
-- })
--

-- vim: ts=2 sts=2 sw=2 et
