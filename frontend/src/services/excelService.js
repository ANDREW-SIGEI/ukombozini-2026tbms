import * as XLSX from 'xlsx';

const ExcelService = {
    /**
     * Export Data to Excel
     * @param {Array} data - Array of objects to export
     * @param {string} fileName - Name of the file (without extension)
     * @param {string} sheetName - Name of the worksheet
     */
    exportToExcel(data, fileName, sheetName = 'Sheet1') {
        // 1. Create a new Workbook
        const wb = XLSX.utils.book_new();

        // 2. Convert Data to Worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // 3. Append Worksheet to Workbook
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // 4. Write File
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    },

    /**
     * Parse Excel File (Import)
     * @param {File} file - The uploaded file
     * @returns {Promise<Array>} - Array of JSON objects
     */
    importFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }
};

export default ExcelService;
