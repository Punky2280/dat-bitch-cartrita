# Cartrita MCP Transformation - Documentation Build System
# Usage: make pdf

# Variables
DOCS_DIR = docs
OUTPUT_DIR = $(DOCS_DIR)/output
WHITEPAPER_MD = $(DOCS_DIR)/Cartrita_Hierarchical_MCP_Transformation_Whitepaper.md
WHITEPAPER_PDF = $(OUTPUT_DIR)/Cartrita_MCP_Whitepaper.pdf
WHITEPAPER_HTML = $(OUTPUT_DIR)/Cartrita_MCP_Whitepaper.html
TEMPLATE_DIR = $(DOCS_DIR)/templates

# Pandoc options
PANDOC_OPTS = \
	--from markdown \
	--to pdf \
	--toc \
	--toc-depth=3 \
	--number-sections \
	--pdf-engine=pdflatex \
	--template=$(TEMPLATE_DIR)/whitepaper.tex \
	--variable fontsize=11pt \
	--variable geometry:margin=1in \
	--variable papersize=a4 \
	--variable colorlinks=true \
	--variable linkcolor=blue \
	--variable urlcolor=blue \
	--variable citecolor=blue \
	--variable toccolor=black

# Default target
.PHONY: all
all: pdf

# Generate PDF from Markdown
.PHONY: pdf
pdf: $(WHITEPAPER_PDF)

$(WHITEPAPER_PDF): $(WHITEPAPER_MD) $(OUTPUT_DIR) $(TEMPLATE_DIR)/whitepaper.tex
	@echo "🔄 Generating PDF from Markdown..."
	pandoc $(PANDOC_OPTS) $(WHITEPAPER_MD) -o $(WHITEPAPER_PDF)
	@echo "✅ PDF generated: $(WHITEPAPER_PDF)"
	@echo "📄 File size: $$(du -h $(WHITEPAPER_PDF) | cut -f1)"

# Generate HTML version
.PHONY: html
html: $(WHITEPAPER_HTML)

$(WHITEPAPER_HTML): $(WHITEPAPER_MD) $(OUTPUT_DIR)
	@echo "🔄 Generating HTML from Markdown..."
	pandoc --from markdown --to html --toc --toc-depth=3 --number-sections --standalone $(WHITEPAPER_MD) -o $(WHITEPAPER_HTML)
	@echo "✅ HTML generated: $(WHITEPAPER_HTML)"
	@echo "📄 File size: $$(du -h $(WHITEPAPER_HTML) | cut -f1)"

# Create output directory
$(OUTPUT_DIR):
	mkdir -p $(OUTPUT_DIR)

# Create LaTeX template directory
$(TEMPLATE_DIR):
	mkdir -p $(TEMPLATE_DIR)

# LaTeX template (already created manually)
$(TEMPLATE_DIR)/whitepaper.tex: $(TEMPLATE_DIR)
	@echo "✅ LaTeX template ready"

# Clean generated files
.PHONY: clean
clean:
	rm -rf $(OUTPUT_DIR)
	@echo "🧹 Cleaned generated files"

# Show file info
.PHONY: info
info:
	@echo "📄 Documentation Status:"
	@if [ -f $(WHITEPAPER_HTML) ]; then \
		echo "   HTML: ✅ Available"; \
		echo "   File: $(WHITEPAPER_HTML)"; \
		echo "   Size: $$(du -h $(WHITEPAPER_HTML) | cut -f1)"; \
		echo "   Modified: $$(stat -c %y $(WHITEPAPER_HTML) 2>/dev/null || stat -f %Sm $(WHITEPAPER_HTML) 2>/dev/null || echo 'Unknown')"; \
	else \
		echo "   HTML: ❌ Not generated. Run 'make html'"; \
	fi
	@if [ -f $(WHITEPAPER_PDF) ]; then \
		echo "   PDF: ✅ Available"; \
		echo "   File: $(WHITEPAPER_PDF)"; \
		echo "   Size: $$(du -h $(WHITEPAPER_PDF) | cut -f1)"; \
		echo "   Modified: $$(stat -c %y $(WHITEPAPER_PDF) 2>/dev/null || stat -f %Sm $(WHITEPAPER_PDF) 2>/dev/null || echo 'Unknown')"; \
		echo "   Pages: $$(pdfinfo $(WHITEPAPER_PDF) 2>/dev/null | grep Pages | awk '{print $$2}' || echo 'Unknown')"; \
	else \
		echo "   PDF: ❌ Not generated. Run 'make pdf' (requires LaTeX)"; \
	fi

# Help
.PHONY: help
help:
	@echo "Cartrita MCP Transformation - Documentation Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make pdf          Generate PDF from Markdown (default)"
	@echo "  make html         Generate HTML from Markdown"
	@echo "  make clean        Remove generated files"
	@echo "  make info         Show information about generated files"
	@echo "  make help         Show this help message"
	@echo ""
	@echo "Generated files will be available at:"
	@echo "  HTML: $(WHITEPAPER_HTML)"
	@echo "  PDF: $(WHITEPAPER_PDF)"