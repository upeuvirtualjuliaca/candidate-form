import{t as e}from"./supabase-Cnm8ql_i.js";var t=`
  id, status, observations, created_at, created_by, created_by_name,
  identification_completed, conversion_completed, faith_completed, ceremony_data_completed,
  students ( id, dni, full_name, program, faculty, campus, birth_date ),
  teachers ( id, dni, full_name, faculty, main_ep, campus, birth_date )
`;async function n(n=1,r=10,i,a,o){let s=(n-1)*r,c=s+r-1,l=e.from(`candidates`).select(t,{count:`exact`}).is(`deleted_at`,null).order(`created_at`,{ascending:!1});if(i&&(l=l.eq(`status`,i)),o&&(l=l.eq(`campaign_id`,o)),a?.trim()){let t=`%${a.trim()}%`,[{data:n},{data:r}]=await Promise.all([e.from(`students`).select(`id`).or(`full_name.ilike.${t},dni.ilike.${t},student_code.ilike.${t}`),e.from(`teachers`).select(`id`).or(`full_name.ilike.${t},dni.ilike.${t}`)]),i=(n??[]).map(e=>e.id),o=(r??[]).map(e=>e.id);if(i.length===0&&o.length===0)return{data:[],count:0};let s=[];i.length>0&&s.push(`student_id.in.(${i.join(`,`)})`),o.length>0&&s.push(`teacher_id.in.(${o.join(`,`)})`),l=l.or(s.join(`,`))}l=l.range(s,c);let{data:u,count:d,error:f}=await l;if(f)throw f;return{data:u??[],count:d??0}}async function r(t){let{data:n,error:r}=await e.from(`candidates`).select(`
      id, student_id, teacher_id, created_by, status, created_at,
      observations, ceremony_type, address, education_level, education_level_other,
      marital_status, wedding_date, has_disability, disability_types,
      church, pastor, baptism_date, identification_observations,
      guardian_1_name, guardian_1_document, guardian_2_name, guardian_2_document,
      ceremony_date, ceremony_place, officiating_pastor, officiating_pastor_dni,
      receiving_church, church_city, administrative_meeting_date, ceremony_notes, ceremony_voto,
      conversion_date, conversion_place, influential_person, spiritual_experience, conversion_observations,
      biblical_instructor_1, biblical_instructor_2, previous_religion,
      how_knew_iasd, how_studied_bible, decisive_factor,
      commitment_checks, faith_answers, final_declaration, faith_observations, consent_accepted, signature_data, guardian_signature_data,
      identification_completed, conversion_completed, faith_completed, ceremony_completed,
      students (
        id, dni, full_name, sex, institutional_email, phone,
        program, faculty, campus, modality, cycle, "group", country, postal_code, birth_date, religion
      ),
      teachers (
        id, dni, full_name, doc_type, academic_degree, dedication_regime,
        labor_condition, campus, faculty, main_ep, condition,
        sex, birth_date, country, phone, email
      )
    `).eq(`id`,t).single();if(r)throw r;let i=n;if(i.deleted_at)throw Error(`CANDIDATE_DELETED`);return i}async function i(t){let{data:n}=await e.from(`candidates`).select(`id`).eq(`student_id`,t).is(`deleted_at`,null).maybeSingle();return n?.id??null}async function a(t,n){let r=await i(t);if(r)throw Object.assign(Error(`DUPLICATE`),{candidateId:r});let a=null;try{let{data:{user:t}}=await e.auth.getUser();a=t?.id??null}catch{}let{data:o,error:s}=await e.from(`candidates`).insert({student_id:t,status:`draft`,created_by:a,created_by_name:n??null}).select(`id`).single();if(s)throw s;return o.id}async function o(t,n,r=!1){let i=!!(n.address?.trim()&&n.education_level),a=!!(n.guardian_1_name?.trim()&&n.guardian_1_document?.trim()&&n.guardian_signature_data?.trim()),o=r?a:i,s=!!(n.biblical_instructor_1?.trim()&&n.how_knew_iasd?.trim()),c=!!(n.consent_accepted&&n.faith_answers&&Object.values(n.faith_answers).some(e=>e!==null)&&n.signature_data?.trim()),l=!!(n.officiating_pastor?.trim()&&n.ceremony_date?.trim()),u=o&&s&&c&&l?`completed`:`draft`,{error:d}=await e.from(`candidates`).update({...n,identification_completed:o,conversion_completed:s,faith_completed:c,ceremony_data_completed:l,status:u}).eq(`id`,t);if(d)throw d;return{identification_completed:o,conversion_completed:s,faith_completed:c,ceremony_completed:l,ceremony_data_completed:l,status:u}}async function s(t){let{error:n}=await e.from(`candidates`).update({deleted_at:new Date().toISOString()}).eq(`id`,t);if(n)throw n}export{n as a,i,s as n,o,r,a as t};