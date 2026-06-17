type CsvValue = string | number | boolean | null | undefined

export function downloadCSV(filename: string, headers: string[], rows: CsvValue[][]) {
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function printCurrentReport() {
  window.print()
}
