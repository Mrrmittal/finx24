package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Go Digit INSURE24 — GL 6000030  →  Parent GL 13126051  |  MI  | MI_INSURE24 */
@Entity
@Table(name = "FLOAT_GO_DIGIT_I24", indexes = {
        @Index(name = "idx_go_digit_i24_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_go_digit_i24_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_go_digit_i24_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatGoDigitI24 extends FloatRecord {

    public static final String GL           = "6000030";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "GoDigitI24";
    public static final String SEGMENT      = "MI_INSURE24";
}