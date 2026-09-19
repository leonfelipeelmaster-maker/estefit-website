const fs = require('fs');
const path = require('path');

// --- Validation Functions ---
function isValidUrl(url) {
    return typeof url === 'string' && /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return typeof phone === 'string' && /^\+?[1-9]\d{1,14}$|^\+?[\d\s\-()]+$/.test(phone);
}

function isValidHex(hex) {
    return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// --- Sanitization Functions ---
function sanitizeHtml(input) {
    if (typeof input !== 'string') return input;
    
    let safe = input;
    
    // Remove dangerous tags
    safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    safe = safe.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    safe = safe.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    safe = safe.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    
    // Remove event handlers
    safe = safe.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
    safe = safe.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
    
    // Escape special characters
    return safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- Helper Functions ---
function resolvePath(obj, pathStr) {
    return pathStr.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

function validateConfig(config) {
    console.log('Validando configuración...');
    
    if (!isValidHex(config.brand.colors.primary)) throw new Error(`Color primario inválido: ${config.brand.colors.primary}`);
    if (!isValidHex(config.brand.colors.secondary)) throw new Error(`Color secundario inválido: ${config.brand.colors.secondary}`);
    
    if (!isValidUrl(config.contact.website)) throw new Error(`URL de sitio web inválida: ${config.contact.website}`);
    if (!isValidEmail(config.contact.email)) throw new Error(`Email inválido: ${config.contact.email}`);
    if (!isValidPhone(config.contact.phone)) throw new Error(`Teléfono inválido: ${config.contact.phone}`);
    
    if (!isValidUrl(config.hero.image)) throw new Error(`URL de imagen del hero inválida: ${config.hero.image}`);
    if (!isValidUrl(config.hero.cta_link)) throw new Error(`Link CTA del hero inválido: ${config.hero.cta_link}`);
    
    if (!config.products || !Array.isArray(config.products.items)) {
        throw new Error('Los elementos de productos deben ser un array');
    }
    
    config.products.items.forEach((product, index) => {
        if (!isValidUrl(product.image)) {
            throw new Error(`URL de imagen inválida para producto ${index + 1} (${product.name}): ${product.image}`);
        }
    });
    
    console.log('Validación completada exitosamente.');
}

function processTemplate(template, config) {
    console.log('Procesando template...');
    
    // Process LOOP blocks first
    const loopRegex = /<!--\s*LOOP\s+([\w.]+)\s+as\s+(\w+)\s*-->([\s\S]*?)<!--\s*END LOOP\s*-->/g;
    
    let processedTemplate = template.replace(loopRegex, (match, arrayPath, itemName, blockContent) => {
        const array = resolvePath(config, arrayPath);
        
        if (!Array.isArray(array)) {
            console.warn(`Advertencia: Loop path '${arrayPath}' no es un array o no existe.`);
            return '';
        }
        
        return array.map(item => {
            return blockContent.replace(/{{\s*([\w.]+)\s*}}/g, (placeholderMatch, key) => {
                let value;
                if (key === itemName) {
                    value = item;
                } else if (key.startsWith(itemName + '.')) {
                    const itemKey = key.substring(itemName.length + 1);
                    value = resolvePath(item, itemKey);
                } else {
                    value = resolvePath(config, key);
                }
                
                return value !== undefined ? sanitizeHtml(String(value)) : placeholderMatch;
            });
        }).join('');
    });
    
    // Process remaining single placeholders
    processedTemplate = processedTemplate.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
        const value = resolvePath(config, key);
        return value !== undefined ? sanitizeHtml(String(value)) : match;
    });
    
    return processedTemplate;
}

// --- Main Execution ---
function build() {
    try {
        console.log('Iniciando proceso de compilación...');
        
        // 1. Read config.json
        const configPath = path.join(__dirname, 'config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error('config.json no encontrado en el directorio actual.');
        }
        
        const configRaw = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configRaw);
        
        // 2. Validate config
        validateConfig(config);
        
        // 3. Read and process index.html
        const indexPath = path.join(__dirname, 'index.html');
        if (!fs.existsSync(indexPath)) {
            throw new Error('index.html no encontrado en el directorio actual.');
        }
        
        const indexTemplate = fs.readFileSync(indexPath, 'utf8');
        const indexHtml = processTemplate(indexTemplate, config);
        
        // 4. Read and process franchise.html
        const franchisePath = path.join(__dirname, 'franchise.html');
        if (!fs.existsSync(franchisePath)) {
            throw new Error('franchise.html no encontrado en el directorio actual.');
        }
        
        const franchiseTemplate = fs.readFileSync(franchisePath, 'utf8');
        const franchiseHtml = processTemplate(franchiseTemplate, config);
        
        // 5. Read and process contact-form.html
        const contactFormPath = path.join(__dirname, 'contact-form.html');
        if (!fs.existsSync(contactFormPath)) {
            throw new Error('contact-form.html no encontrado en el directorio actual.');
        }
        
        const contactFormTemplate = fs.readFileSync(contactFormPath, 'utf8');
        const contactFormHtml = processTemplate(contactFormTemplate, config);
        
        // 6. Generate output directory
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('Directorio de salida creado.');
        }
        
        // 7. Write all output files
        fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf8');
        console.log(`✓ Generado: ${path.join(outputDir, 'index.html')}`);
        
        fs.writeFileSync(path.join(outputDir, 'franchise.html'), franchiseHtml, 'utf8');
        console.log(`✓ Generado: ${path.join(outputDir, 'franchise.html')}`);
        
        fs.writeFileSync(path.join(outputDir, 'contact-form.html'), contactFormHtml, 'utf8');
        console.log(`✓ Generado: ${path.join(outputDir, 'contact-form.html')}`);
        
        console.log('\n¡Compilación exitosa! Todas las páginas han sido generadas.');
        
    } catch (error) {
        console.error('La compilación falló con error:', error.message);
        process.exit(1);
    }
}

// Run the build
build();
