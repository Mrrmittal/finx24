package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Kotak INSURE24 — GL 6000032  →  Parent GL 13126051  |  MI  | MI_INSURE24 */
@Entity
@Table(name = "FLOAT_KOTAK_I24", indexes = {
        @Index(name = "idx_kotak_i24_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_kotak_i24_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_kotak_i24_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatKotakI24 extends FloatRecord {

    public static final String GL           = "6000032";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "KotakI24";
    public static final String SEGMENT      = "MI_INSURE24";
}