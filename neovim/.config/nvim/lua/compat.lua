local function fallback_flatten(tbl)
  local result = {}
  local function flatten_impl(current)
    local n = #current
    for i = 1, n do
      local value = current[i]
      if type(value) == 'table' then
        flatten_impl(value)
      elseif value then
        result[#result + 1] = value
      end
    end
  end
  flatten_impl(tbl)
  return result
end

if vim.tbl_flatten then
  vim.tbl_flatten = function(tbl)
    if vim.iter then
      return vim.iter(tbl):flatten():totable()
    end
    return fallback_flatten(tbl)
  end
end

return {}
