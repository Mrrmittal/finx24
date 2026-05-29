package com.Finx24.float_register;

import java.util.*;

public final class FloatConstants {
    private FloatConstants() {}

    public static final String PARENT_GL_LI = "13126064";
    public static final String PARENT_GL_MI = "13126051";

    /** partnerCode → display name */
    public static final Map<String,String> DISPLAY = new LinkedHashMap<>();

    /** sheetName → partnerCode */
    public static final Map<String,String> SHEET_TO_PARTNER = new LinkedHashMap<>();

    /** partnerCode → GL account */
    public static final Map<String,String> GL = new LinkedHashMap<>();

    /** partnerCode → category (LI/MI) */
    public static final Map<String,String> CATEGORY = new LinkedHashMap<>();

    /** partnerCode → segment */
    public static final Map<String,String> SEGMENT = new LinkedHashMap<>();

    /** partnerCode → DB table name */
    public static final Map<String,String> TABLE = new LinkedHashMap<>();

    static {
        // ── LI ────────────────────────────────────────────────
        add("Go_Digit_LI",          "Go Digit",            "Go Digit",         "8503595", "LI",  null,          "FLOAT_GO_DIGIT_LI");
        add("Kotak_LI",             "Kotak",               "Kotak",            "8503598", "LI",  null,          "FLOAT_KOTAK_LI");
        // ── MI_GS ─────────────────────────────────────────────
        add("Tata_AIG_MI_GS",       "TATA AIG",            "Tata AIG",         "6000015", "MI",  "MI_GS",       "FLOAT_TATA_AIG");
        add("ICICI_Lombard_MI_GS",  "ICICI",               "ICICI Lombard",    "6000005", "MI",  "MI_GS",       "FLOAT_ICICI_GS");
        add("United_MI_GS",         "United",              "United",           "6000007", "MI",  "MI_GS",       "FLOAT_UNITED");
        add("Go_Digit_MI_GS",       "Go Digit GS",         "Go Digit GS",      "6000000", "MI",  "MI_GS",       "FLOAT_GO_DIGIT_GS");
        add("Kotak_MI_GS",          "Kotak GS",            "Kotak GS",         "6000002", "MI",  "MI_GS",       "FLOAT_KOTAK_GS");
        // ── MI_INSURE24 ───────────────────────────────────────
        add("Go_Digit_INSURE24",    "Go Digit Insure24",   "Go Digit INSURE24","6000030", "MI",  "MI_INSURE24", "FLOAT_GO_DIGIT_I24");
        add("Kotak_INSURE24",       "Kotak Insure24",      "Kotak INSURE24",   "6000032", "MI",  "MI_INSURE24", "FLOAT_KOTAK_I24");
        add("Tata_INSURE24",        "TATA Insure24",       "Tata INSURE24",    "6000031", "MI",  "MI_INSURE24", "FLOAT_TATA_I24");
        add("ICICI_Lombard_INSURE24","ICICI - INSURE24",   "ICICI INSURE24",   "6000038", "MI",  "MI_INSURE24", "FLOAT_ICICI_I24");
        add("Bajaj_INSURE24",       "Bajaj Insure24",      "Bajaj INSURE24",   "6000037", "MI",  "MI_INSURE24", "FLOAT_BAJAJ_I24");
        // ── MI_DO ─────────────────────────────────────────────
        add("Go_Digit_DO",          "Go Digit - DO",       "Go Digit DO",      "6000040", "MI",  "MI_DO",       "FLOAT_GO_DIGIT_DO");
        // ── EW ────────────────────────────────────────────────
        add("Bajaj_EW",             "BAGIC - EW",          "Bajaj EW",         "6000009", "MI",  "EW",          "FLOAT_BAJAJ_EW");
    }

    private static void add(String code, String sheet, String display,
                            String gl, String cat, String seg, String table) {
        SHEET_TO_PARTNER.put(sheet, code);
        DISPLAY.put(code, display);
        GL.put(code, gl);
        CATEGORY.put(code, cat);
        if (seg != null) SEGMENT.put(code, seg);
        TABLE.put(code, table);
    }

    // ── Backward-compatible computed maps ────────────────────────
    /** partnerCode → GL  (LI only) */
    public static final Map<String,String> LI_PARTNERS;
    /** segment → (partnerCode → GL)  (MI only) */
    public static final Map<String, Map<String,String>> MI_SEGMENTS;

    static {
        LI_PARTNERS = new LinkedHashMap<>();
        CATEGORY.forEach((code, cat) -> {
            if ("LI".equals(cat)) LI_PARTNERS.put(code, GL.get(code));
        });

        MI_SEGMENTS = new LinkedHashMap<>();
        CATEGORY.forEach((code, cat) -> {
            if ("MI".equals(cat)) {
                String seg = SEGMENT.getOrDefault(code, "OTHER");
                MI_SEGMENTS.computeIfAbsent(seg, k -> new LinkedHashMap<>())
                        .put(code, GL.get(code));
            }
        });
    }

    public static String getGl(String partnerCode)    { return GL.getOrDefault(partnerCode,""); }
    public static String getTable(String partnerCode) { return TABLE.getOrDefault(partnerCode,""); }
    public static String getParentGl(String cat)      { return "LI".equals(cat) ? PARENT_GL_LI : PARENT_GL_MI; }
    public static List<String> liPartners()           { return CATEGORY.entrySet().stream().filter(e->"LI".equals(e.getValue())).map(Map.Entry::getKey).toList(); }
    public static List<String> miPartners()           { return CATEGORY.entrySet().stream().filter(e->"MI".equals(e.getValue())).map(Map.Entry::getKey).toList(); }
}