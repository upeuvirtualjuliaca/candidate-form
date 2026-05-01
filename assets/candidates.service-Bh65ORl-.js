import{t as e}from"./index-BL6y0pvQ.js";var t=`
  id, status, observations, created_at,
  identification_completed, conversion_completed, faith_completed,
  students ( id, dni, full_name, program, faculty, campus ),
  teachers ( id, dni, full_name, faculty, main_ep, campus )
`;async function n(n=1,r=10,i){let a=(n-1)*r,o=a+r-1,s=e.from(`candidates`).select(t,{count:`exact`}).order(`created_at`,{ascending:!1}).range(a,o);i&&(s=s.eq(`status`,i));let{data:c,count:l,error:u}=await s;if(u)throw u;return{data:c??[],count:l??0}}async function r(t){let{data:n,error:r}=await e.from(`candidates`).select(`
      id, student_id, teacher_id, created_by, status, created_at,
      observations, ceremony_type, address, education_level, education_level_other,
      marital_status, wedding_date, has_disability, disability_types,
      church, pastor, baptism_date, identification_observations,
      guardian_1_name, guardian_1_document, guardian_2_name, guardian_2_document,
      ceremony_date, ceremony_place, officiating_pastor, officiating_pastor_dni,
      receiving_church, church_city, administrative_meeting_date, ceremony_notes,
      conversion_date, conversion_place, influential_person, spiritual_experience, conversion_observations,
      biblical_instructor_1, biblical_instructor_2, previous_religion,
      how_knew_iasd, how_studied_bible, decisive_factor,
      commitment_checks, faith_answers, final_declaration, faith_observations, consent_accepted, signature_data,
      identification_completed, conversion_completed, faith_completed, ceremony_completed,
      students (
        id, dni, full_name, sex, institutional_email, phone,
        program, faculty, campus, modality, cycle, "group", country, postal_code, birth_date, religion
      ),
      teachers (
        id, dni, full_name, doc_type, academic_degree, dedication_regime,
        labor_condition, campus, faculty, main_ep, condition
      )
    `).eq(`id`,t).single();if(r)throw r;return n}async function i(t){let{data:n}=await e.from(`candidates`).select(`id`).eq(`student_id`,t).maybeSingle();return n?.id??null}async function a(t){let n=await i(t);if(n)throw Object.assign(Error(`DUPLICATE`),{candidateId:n});let{data:r,error:a}=await e.from(`candidates`).insert({student_id:t,status:`draft`}).select(`id`).single();if(a)throw a;return r.id}async function o(t,n){let r=!!n.address?.trim(),i=!!(n.biblical_instructor_1?.trim()&&n.how_knew_iasd?.trim()),a=!!(n.consent_accepted&&n.faith_answers&&Object.values(n.faith_answers).some(e=>e!==null)),o=!!(n.officiating_pastor?.trim()&&n.ceremony_date),s=r&&i&&a&&o?`completed`:`draft`,{error:c}=await e.from(`candidates`).update({...n,identification_completed:r,conversion_completed:i,faith_completed:a,ceremony_completed:o,status:s}).eq(`id`,t);if(c)throw c;return{identification_completed:r,conversion_completed:i,faith_completed:a,ceremony_completed:o,status:s}}async function s(t){let{error:n}=await e.from(`candidates`).delete().eq(`id`,t);if(n)throw n}export{n as a,i,s as n,o,r,a as t};