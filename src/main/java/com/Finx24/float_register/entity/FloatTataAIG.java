package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Tata AIG GS — GL 6000015  →  Parent GL 13126051  |  MI  | MI_GS */
@Entity
@Table(name = "FLOAT_TATA_AIG", indexes = {
        @Index(name = "idx_tata_aig_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_tata_aig_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_tata_aig_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatTataAIG extends FloatRecord {

    public static final String GL           = "6000015";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "TataAIG";
    public static final String SEGMENT      = "MI_GS";
}