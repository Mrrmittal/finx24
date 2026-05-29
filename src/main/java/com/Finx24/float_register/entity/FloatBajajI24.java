package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Bajaj INSURE24 — GL 6000037  →  Parent GL 13126051  |  MI  | MI_INSURE24 */
@Entity
@Table(name = "FLOAT_BAJAJ_I24", indexes = {
        @Index(name = "idx_bajaj_i24_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_bajaj_i24_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_bajaj_i24_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatBajajI24 extends FloatRecord {

    public static final String GL           = "6000037";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "BajajI24";
    public static final String SEGMENT      = "MI_INSURE24";
}