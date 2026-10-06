import logging
import sys
from pathlib import Path
import pymupdf
import json
import openpyxl

class Parser:
    """
    Parser class for section aware parsing
    """
    def __init__(self, file_path: str, mapper: str):
        self.file_path = file_path
        self.mapper = mapper
        
        # Load the mapping from the Excel file
        wb = openpyxl.load_workbook(self.mapper)
        ws = wb.active
        self.mapping = []
        iter = ws.iter_rows(values_only=True)
        header = next(iter)
        for row in iter:
            # Assuming Column A is the PDF section header, Column B is the JSON key
            if row[0] and row[1]:
                self.mapping.append((str(row[0]).strip(), str(row[1]).strip()))

    def parse(self):
        """
        Parse the PDF file using the mapper
        """
        doc = pymupdf.open(self.file_path)
        parsed_data = {v: "" for k, v in self.mapping}
        current_section = None
        
        for page in doc:
            blocks = page.get_text("blocks")
            for b in blocks:
                # b[4] contains the text of the block
                text = b[4].strip()
                if not text:
                    continue
                
                # Check if this block starts a new section
                for header, key in self.mapping:
                    # Case insensitive check and handling potential whitespace
                    if text.lower().startswith(header.lower()):
                        current_section = key
                        break
                        
                if current_section:
                    parsed_data[current_section] += text + "\n\n"
                    
        return parsed_data

if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )

    parser = argparse.ArgumentParser(description="Parse a HIQA report PDF using an Excel mapper.")
    parser.add_argument("pdf_path", type=Path, help="Path to the PDF file to parse")
    parser.add_argument("mapper_path", type=Path, help="Path to the Excel mapper file")
    
    args = parser.parse_args()
    
    if not args.mapper_path.exists():
        logging.error(f"Mapper Excel file not found: {args.mapper_path}")
        sys.exit(1)

    if not args.pdf_path.exists():
        logging.error(f"PDF file not found: {args.pdf_path}")
        sys.exit(1)
            
    logging.info(f"Parsing {args.pdf_path.name}...")
    pdf_parser = Parser(str(args.pdf_path), str(args.mapper_path))
    parsed_data = pdf_parser.parse()
    
    # Save to individual JSON file in the same directory as the PDF
    output_file = args.pdf_path.parent / f"{args.pdf_path.stem}_parsed.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, indent=2, ensure_ascii=False)
        
    logging.info(f"Saved parsed data to {output_file.name}")

