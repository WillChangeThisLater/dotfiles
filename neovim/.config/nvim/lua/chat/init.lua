local M = {}

M.config = {
  max_lines = 1000,      -- how many trailing lines to send as context
  llm_cmd   = { "llm" }, -- CLI + args; reads from stdin, writes to stdout
  stream    = false,     -- set true if your `llm` streams tokens
}

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})
  vim.api.nvim_create_user_command("Chat", function() M.chat() end,
    { desc = "Send last N lines to llm and append response" })
  vim.keymap.set("n", "<leader>cc", ":Chat<CR>", { silent = true, desc = "Chat: send context" })
end

local running = false

local function ensure_llm_available()
  local exe = M.config.llm_cmd[1]
  if vim.fn.executable(exe) == 0 then
    vim.notify(("`%s` not found in PATH"):format(exe), vim.log.levels.ERROR)
    return false
  end
  return true
end

-- ── simple EOL spinner indicator ──────────────────────────────────────────────
local spinner_frames = { "⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏" }

local function start_indicator(bufnr, row)
  M._ns = M._ns or vim.api.nvim_create_namespace("chat_indicator")
  local ns = M._ns
  local frame = 1
  local id = vim.api.nvim_buf_set_extmark(bufnr, ns, row, 0, {
    virt_text = { { " Chat ", "Comment" }, { spinner_frames[frame], "DiagnosticWarn" } },
    virt_text_pos = "eol",
  })

  local timer = vim.uv.new_timer()
  timer:start(0, 80, function()
    frame = (frame % #spinner_frames) + 1
    vim.schedule(function()
      if not vim.api.nvim_buf_is_valid(bufnr) then return end
      pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, row, 0, {
        id = id,
        virt_text = { { " Chat ", "Comment" }, { spinner_frames[frame], "DiagnosticWarn" } },
        virt_text_pos = "eol",
      })
    end)
  end)

  local function move(new_row) row = new_row end

  local function stop(status)
    if timer and not timer:is_closing() then timer:stop(); timer:close() end
    local vt = (status == "ok")
      and { { " Chat ", "Comment" }, { "✓", "DiagnosticOk" } }
      or  { { " Chat ", "Comment" }, { "✗", "DiagnosticError" } }
    vim.schedule(function()
      pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, row, 0, {
        id = id, virt_text = vt, virt_text_pos = "eol",
      })
      vim.defer_fn(function()
        pcall(vim.api.nvim_buf_del_extmark, bufnr, ns, id)
      end, 600)
    end)
  end

  return { move = move, stop = stop }
end
-- ─────────────────────────────────────────────────────────────────────────────

function M.chat()
  if running then
    vim.notify("Chat already running…", vim.log.levels.WARN)
    return
  end
  if not ensure_llm_available() then return end
  running = true

  local bufnr = vim.api.nvim_get_current_buf()
  local total = vim.api.nvim_buf_line_count(bufnr)
  local start = math.max(0, total - M.config.max_lines)
  local lines = vim.api.nvim_buf_get_lines(bufnr, start, total, false)
  local input = table.concat(lines, "\n")

  -- separator before the model’s response
  vim.api.nvim_buf_set_lines(bufnr, total, total, false, { "" })

  -- indicator lives on the output line
  local out_line = total
  local indicator = start_indicator(bufnr, out_line)

  if M.config.stream then
    -- STREAMING: append to current line; only break on real newlines
    local function strip_ansi(s) return s:gsub("\27%[[0-9;]*[A-Za-z]", "") end

    local function append_text(chunk)
      chunk = strip_ansi(chunk:gsub("\r", ""))
      local parts = vim.split(chunk, "\n", { plain = true })
      for i, part in ipairs(parts) do
        local curr = vim.api.nvim_buf_get_lines(bufnr, out_line, out_line + 1, false)[1] or ""
        vim.api.nvim_buf_set_lines(bufnr, out_line, out_line + 1, false, { curr .. part })
        if i < #parts then
          vim.api.nvim_buf_set_lines(bufnr, out_line + 1, out_line + 1, false, { "" })
          out_line = out_line + 1
          indicator.move(out_line) -- keep spinner at the active line
        end
      end
    end

    local job_id = vim.fn.jobstart(M.config.llm_cmd, {
      stdin = "pipe",
      on_stdout = function(_, data, _)
        if not data then return end
        local chunk = table.concat(data, "\n")
        vim.schedule(function() append_text(chunk) end)
      end,
      on_stderr = function(_, data, _)
        if data and #data > 0 then
          vim.schedule(function()
            vim.notify(table.concat(data, "\n"), vim.log.levels.ERROR)
          end)
        end
      end,
      on_exit = function(_, code, _)
        running = false
        indicator.stop(code == 0 and "ok" or "err")
        if code ~= 0 then
          vim.schedule(function()
            vim.notify("llm exited with code " .. tostring(code), vim.log.levels.ERROR)
          end)
        end
      end,
    })
    vim.fn.chansend(job_id, input)
    vim.fn.chanclose(job_id, "stdin")
    return
  end

  -- NON-STREAMING: run once, then append
  vim.system(M.config.llm_cmd, { stdin = input, text = true }, function(res)
    running = false
    if res.code ~= 0 then
      indicator.stop("err")
      vim.schedule(function()
        vim.notify(res.stderr or "llm failed", vim.log.levels.ERROR)
      end)
      return
    end
    local out = res.stdout or ""
    local out_lines = vim.split(out, "\n", { plain = true })
    if #out_lines > 0 and out_lines[#out_lines] == "" then table.remove(out_lines) end
    vim.schedule(function()
      indicator.stop("ok")
      vim.api.nvim_buf_set_lines(bufnr, -1, -1, false, out_lines)
    end)
  end)
end

return M
