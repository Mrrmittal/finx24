package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** United GS — GL 6000007  →  Parent GL 13126051  |  MI  | MI_GS */
@Entity
@Table(name = "FLOAT_UNITED", indexes = {
        @Index(name = "idx_united_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_united_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_united_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatUnited extends FloatRecord {

    public static final String GL           = "6000007";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "United";
    public static final String SEGMENT      = "MI_GS";
}