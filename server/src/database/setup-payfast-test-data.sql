-- PayFast Integration Test Data Setup
-- This script creates test data for PayFast payment and invoice PDF integration

-- Insert test quote for PayFast testing
INSERT INTO quotes (
    quote_number,
    customer_name,
    customer_email,
    customer_phone,
    project_name,
    items,
    subtotal,
    tax,
    total,
    branch_name,
    status,
    created_at,
    updated_at
) VALUES (
    'Q-20250805-PAYFAST-TEST',
    'Test Customer',
    'test@example.com',
    '0821234567',
    'PayFast Test Project',
    '[
        {
            "description": "White Melamine Shelving 2000x460",
            "quantity": 2,
            "price": 250.25,
            "total": 500.50,
            "material": "White Melamine",
            "dimensions": "2000x460"
        },
        {
            "description": "Installation Service",
            "quantity": 1,
            "price": 750.00,
            "total": 750.00,
            "material": "Service",
            "dimensions": "N/A"
        }
    ]',
    1250.50,
    0.00,
    1250.50,
    'HDS Products',
    'pending',
    NOW(),
    NOW()
);

-- Insert test quote for branch testing
INSERT INTO quotes (
    quote_number,
    customer_name,
    customer_email,
    customer_phone,
    project_name,
    items,
    subtotal,
    tax,
    total,
    branch_name,
    status,
    created_at,
    updated_at
) VALUES (
    'Q-20250805-BRANCH-TEST',
    'Branch Test Customer',
    'branch@example.com',
    '0829876543',
    'Branch Integration Test',
    '[
        {
            "description": "White Messonite Doors 900x600",
            "quantity": 4,
            "price": 180.75,
            "total": 723.00,
            "material": "White Messonite",
            "dimensions": "900x600"
        },
        {
            "description": "Hinges and Hardware",
            "quantity": 8,
            "price": 25.50,
            "total": 204.00,
            "material": "Hardware",
            "dimensions": "N/A"
        }
    ]',
    927.00,
    0.00,
    927.00,
    'Cape Town',
    'pending',
    NOW(),
    NOW()
);

-- Insert test quote for WhatsApp integration
INSERT INTO quotes (
    quote_number,
    customer_name,
    customer_email,
    customer_phone,
    project_name,
    items,
    subtotal,
    tax,
    total,
    branch_name,
    status,
    created_at,
    updated_at
) VALUES (
    'Q-20250805-WHATSAPP-TEST',
    'WhatsApp Test Customer',
    'whatsapp@example.com',
    '0825551234',
    'WhatsApp Integration Test',
    '[
        {
            "description": "Custom Kitchen Cabinets",
            "quantity": 1,
            "price": 3500.00,
            "total": 3500.00,
            "material": "Custom",
            "dimensions": "Various"
        },
        {
            "description": "Countertops",
            "quantity": 2,
            "price": 450.00,
            "total": 900.00,
            "material": "Granite",
            "dimensions": "Standard"
        }
    ]',
    4400.00,
    0.00,
    4400.00,
    'Johannesburg',
    'pending',
    NOW(),
    NOW()
);

-- Insert test invoice for PDF testing
INSERT INTO invoices (
    invoice_number,
    quote_number,
    customer_name,
    customer_email,
    customer_phone,
    project_name,
    items,
    subtotal,
    tax,
    total,
    payment_method,
    payment_reference,
    payment_date,
    status,
    pdf_url,
    created_at,
    due_date
) VALUES (
    'INV-20250805-TEST-001',
    'Q-20250805-PAYFAST-TEST',
    'Test Customer',
    'test@example.com',
    '0821234567',
    'PayFast Test Project',
    '[
        {
            "description": "White Melamine Shelving 2000x460",
            "quantity": 2,
            "price": 250.25,
            "total": 500.50
        },
        {
            "description": "Installation Service",
            "quantity": 1,
            "price": 750.00,
            "total": 750.00
        }
    ]',
    1250.50,
    0.00,
    1250.50,
    'PayFast',
    'PF-TEST-123456789',
    NOW(),
    'paid',
    'https://your-supabase-url.supabase.co/storage/v1/object/public/invoices/invoice-INV-20250805-TEST-001-1642245678900.pdf',
    NOW(),
    NOW() + INTERVAL '30 days'
);

-- Verify test data
SELECT 
    q.quote_number,
    q.customer_name,
    q.total,
    q.branch_name,
    q.status,
    i.invoice_number,
    i.pdf_url,
    i.payment_method
FROM quotes q
LEFT JOIN invoices i ON q.quote_number = i.quote_number
WHERE q.quote_number LIKE '%TEST%'
ORDER BY q.created_at DESC;

-- Test queries for PayFast integration
-- Test 1: Get quote by number for payment processing
SELECT * FROM quotes WHERE quote_number = 'Q-20250805-PAYFAST-TEST';

-- Test 2: Get invoice by quote number for PDF generation
SELECT * FROM invoices WHERE quote_number = 'Q-20250805-PAYFAST-TEST';

-- Test 3: Check PDF URLs in invoices
SELECT 
    invoice_number,
    quote_number,
    pdf_url,
    CASE 
        WHEN pdf_url IS NOT NULL THEN 'PDF Available'
        ELSE 'No PDF'
    END as pdf_status
FROM invoices 
WHERE invoice_number LIKE '%TEST%';

-- Test 4: Branch-based queries
SELECT 
    branch_name,
    COUNT(*) as quote_count,
    SUM(total) as total_value
FROM quotes 
WHERE quote_number LIKE '%TEST%'
GROUP BY branch_name;

-- Cleanup queries (run after testing)
-- DELETE FROM invoices WHERE invoice_number LIKE '%TEST%';
-- DELETE FROM quotes WHERE quote_number LIKE '%TEST%';

-- Verification query for PayFast integration
SELECT 
    'PayFast Test Data Ready' as status,
    (SELECT COUNT(*) FROM quotes WHERE quote_number LIKE '%TEST%') as test_quotes,
    (SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE '%TEST%') as test_invoices;
